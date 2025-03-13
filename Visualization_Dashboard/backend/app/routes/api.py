from flask import Blueprint, jsonify, request
from bson import json_util
import json
import app

api_bp = Blueprint('api', __name__)

# Helper function to get db
def get_db():
    return app.db

# Helper function to parse MongoDB results
def parse_json(data):
    return json.loads(json_util.dumps(data))

# Helper function to build query filter
def build_query_filter(request_args):
    """Build a MongoDB query filter from request arguments"""
    query = {}
    
    # Standard filters
    if end_year := request_args.get('end_year'):
        if end_year != 'all':
            query['end_year'] = end_year
    
    if topic := request_args.get('topic'):
        if topic != 'all':
            # Check if we want exact matching
            exact_match = request_args.get('exact_match', 'false').lower() == 'true'
            if exact_match:
                # Use exact match
                query['topic'] = topic
            else:
                # Use case-insensitive regex to match topics containing the keyword
                query['topic'] = {'$regex': topic, '$options': 'i'}
    
    if sector := request_args.get('sector'):
        if sector != 'all':
            query['sector'] = sector
    
    if region := request_args.get('region'):
        if region != 'all':
            query['region'] = region
    
    if pestle := request_args.get('pestle'):
        if pestle != 'all':
            query['pestle'] = pestle
    
    if source := request_args.get('source'):
        if source != 'all':
            query['source'] = source
   
    if country := request_args.get('country'):
        if country != 'all':
            query['country'] = country
    
    
    
    return query

@api_bp.route('/data', methods=['GET'])
def get_data():
    """Get data with optional filters"""
    # Build query filter from request args
    query = build_query_filter(request.args)
    
    # Query database
    insights = list(get_db().insights.find(query))
    
    return jsonify(parse_json(insights))

@api_bp.route('/filters', methods=['GET'])
def get_filters():
    """Get all available filter options"""
    filters = {
        'end_year': [str(year) for year in get_db().insights.distinct('end_year') if year],
        'topics': [topic for topic in get_db().insights.distinct('topic') if topic],
        'sectors': [sector for sector in get_db().insights.distinct('sector') if sector],
        'regions': [region for region in get_db().insights.distinct('region') if region],
        'pestle': [pestle for pestle in get_db().insights.distinct('pestle') if pestle],
        'sources': [source for source in get_db().insights.distinct('source') if source],
        'countries': [country for country in get_db().insights.distinct('country') if country],
    }
    
    return jsonify(filters)

@api_bp.route('/metrics', methods=['GET'])
def get_metrics():
    """Get aggregated metrics for visualization with filters"""
    group_by = request.args.get('group_by', 'year')
    metric = request.args.get('metric', 'intensity')
    
    allowed_metrics = ['intensity', 'likelihood', 'relevance']
    allowed_groups = ['year', 'country', 'topic', 'region', 'sector', 'pestle']
    
    if metric not in allowed_metrics:
        return jsonify({"error": f"Invalid metric. Allowed values: {allowed_metrics}"}), 400
        
    if group_by not in allowed_groups:
        return jsonify({"error": f"Invalid grouping. Allowed values: {allowed_groups}"}), 400
    
    # Handle special case for 'year' as it could be either 'start_year' or 'end_year'
    group_field = 'start_year' if group_by == 'year' else group_by
    
    # Get filters
    match_filter = build_query_filter(request.args)
    
    # Add metric exists condition
    match_filter.update({
        metric: {"$exists": True, "$ne": None},
        group_field: {"$exists": True, "$ne": None}
    })
    
    # MongoDB aggregation pipeline
    pipeline = [
        {"$match": match_filter},
        {"$group": {
            "_id": f"${group_field}",
            "average": {"$avg": f"${metric}"},
            "count": {"$sum": 1},
            "sum": {"$sum": f"${metric}"}
        }},
        {"$sort": {"_id": 1}}
    ]
    
    results = list(get_db().insights.aggregate(pipeline))
    
    formatted_results = [
        {
            "name": result["_id"],
            "value": result["average"],
            "count": result["count"],
            "sum": result["sum"]
        } for result in results
    ]
    
    return jsonify(formatted_results)

@api_bp.route('/topN', methods=['GET'])
def get_top_n():
    """Get top N entries for a specific metric with filters"""
    metric = request.args.get('metric', 'intensity')
    group_by = request.args.get('group_by', 'country')
    limit = int(request.args.get('limit', 10))
    
    allowed_metrics = ['intensity', 'likelihood', 'relevance']
    allowed_groups = ['country', 'topic', 'region', 'sector', 'pestle', 'source']
    
    if metric not in allowed_metrics:
        return jsonify({"error": f"Invalid metric. Allowed values: {allowed_metrics}"}), 400
        
    if group_by not in allowed_groups:
        return jsonify({"error": f"Invalid grouping. Allowed values: {allowed_groups}"}), 400
    
    # Get filters
    match_filter = build_query_filter(request.args)
    
    # Add metric and group_by exists conditions
    match_filter.update({
        metric: {"$exists": True, "$ne": None},
        group_by: {"$exists": True, "$ne": "", "$ne": None}
    })
    
    # MongoDB aggregation pipeline
    pipeline = [
        {"$match": match_filter},
        {"$group": {
            "_id": f"${group_by}",
            "average": {"$avg": f"${metric}"},
            "count": {"$sum": 1}
        }},
        {"$sort": {"average": -1}},
        {"$limit": limit}
    ]
    
    results = list(get_db().insights.aggregate(pipeline))
    
    formatted_results = [
        {
            "name": result["_id"],
            "value": result["average"],
            "count": result["count"]
        } for result in results
    ]
    
    return jsonify(formatted_results)

@api_bp.route('/timeseries', methods=['GET'])
def get_timeseries():
    """Get time series data for visualization with filters"""
    metric = request.args.get('metric', 'intensity')
    
    allowed_metrics = ['intensity', 'likelihood', 'relevance']
    
    if metric not in allowed_metrics:
        return jsonify({"error": f"Invalid metric. Allowed values: {allowed_metrics}"}), 400
    
    # Get filters
    match_filter = build_query_filter(request.args)
    
    # Add metric and start_year exists conditions
    match_filter.update({
        metric: {"$exists": True, "$ne": None},
        "$or": [
        {"start_year": {"$exists": True, "$ne": None}},
        {"end_year": {"$exists": True, "$ne": None}}
    ]
    })
    
    # MongoDB aggregation pipeline
    pipeline = [
        {"$match": match_filter},
        {"$group": {
            "_id": "$start_year",
            "average": {"$avg": f"${metric}"},
            "count": {"$sum": 1}
        }},
        {"$sort": {"_id": 1}}
    ]
    
    results = list(get_db().insights.aggregate(pipeline))
    
    formatted_results = [
        {
            "year": result["_id"],
            "value": result["average"],
            "count": result["count"]
        } for result in results
    ]
    
    return jsonify(formatted_results)

@api_bp.route('/topics', methods=['GET'])
def get_topics():
    """Get topic analysis data with filters"""
    # Get filters
    print("Request args: ", request.args)
    match_filter = build_query_filter(request.args)
    print("Match filter: ", match_filter)
    
    # Add topic exists condition
    match_filter.update({
        "topic": {"$exists": True, "$ne": "", "$ne": None}
    })
    
    # Special handling for topic with exact_match=true
    topic = request.args.get('topic')
    exact_match = request.args.get('exact_match', 'false').lower() == 'true'
    
    if topic and topic != 'all' and exact_match:
        # Override the topic filter to use exact match
        match_filter['topic'] = topic
        
    # MongoDB aggregation pipeline for topics
    pipeline = [
        {"$match": match_filter},
        {"$group": {
            "_id": "$topic",
            "intensity_avg": {"$avg": "$intensity"},
            "likelihood_avg": {"$avg": "$likelihood"},
            "relevance_avg": {"$avg": "$relevance"},
            "count": {"$sum": 1}
        }},
        {"$sort": {"count": -1}},
        {"$limit": 20}
    ]
    
    results = list(get_db().insights.aggregate(pipeline))
    
    formatted_results = [
        {
            "topic": result["_id"],
            "intensity": result["intensity_avg"],
            "likelihood": result["likelihood_avg"],
            "relevance": result["relevance_avg"],
            "count": result["count"]
        } for result in results
    ]
    
    return jsonify(formatted_results)

@api_bp.route('/regions', methods=['GET'])
def get_regions():
    """Get region analysis data with filters including sources and topics"""
    # Get filters
    match_filter = build_query_filter(request.args)
    
    # Add region exists condition
    match_filter.update({
        "region": {"$exists": True, "$ne": "", "$ne": None}
    })
    
    # MongoDB aggregation pipeline for regions
    pipeline = [
        {"$match": match_filter},
        {"$group": {
            "_id": "$region",
            "intensity_avg": {"$avg": "$intensity"},
            "likelihood_avg": {"$avg": "$likelihood"},
            "relevance_avg": {"$avg": "$relevance"},
            "count": {"$sum": 1},
            # Collect all topics and sources for each region
            "topics": {"$addToSet": "$topic"},
            "sources": {"$addToSet": "$source"}
        }},
        {"$sort": {"count": -1}}
    ]
    
    results = list(get_db().insights.aggregate(pipeline))
    
    formatted_results = [
        {
            "region": result["_id"],
            "intensity": result["intensity_avg"],
            "likelihood": result["likelihood_avg"],
            "relevance": result["relevance_avg"],
            "count": result["count"],
            # Include topics and sources in the result
            "topics": [topic for topic in result["topics"] if topic],
            "sources": [source for source in result["sources"] if source]
        } for result in results
    ]
    
    return jsonify(formatted_results)

@api_bp.route('/sectors', methods=['GET'])
def get_sectors():
    """Get sector analysis data with filters"""
    # Get filters
    match_filter = build_query_filter(request.args)
    
    # Add sector exists condition
    match_filter.update({
        "sector": {"$exists": True, "$ne": "", "$ne": None}
    })
    
    # MongoDB aggregation pipeline for sectors
    pipeline = [
        {"$match": match_filter},
        {"$group": {
            "_id": "$sector",
            "intensity_avg": {"$avg": "$intensity"},
            "likelihood_avg": {"$avg": "$likelihood"},
            "relevance_avg": {"$avg": "$relevance"},
            "count": {"$sum": 1}
        }},
        {"$sort": {"count": -1}}
    ]
    
    results = list(get_db().insights.aggregate(pipeline))
    
    formatted_results = [
        {
            "sector": result["_id"],
            "intensity": result["intensity_avg"],
            "likelihood": result["likelihood_avg"],
            "relevance": result["relevance_avg"],
            "count": result["count"]
        } for result in results
    ]
    
    return jsonify(formatted_results)

@api_bp.route('/pest', methods=['GET'])
def get_pest():
    """Get PEST analysis data with filters"""
    # Get filters
    match_filter = build_query_filter(request.args)
    
    # Add pestle exists condition
    match_filter.update({
        "pestle": {"$exists": True, "$ne": "", "$ne": None}
    })
    
    # MongoDB aggregation pipeline for PEST
    pipeline = [
        {"$match": match_filter},
        {"$group": {
            "_id": "$pestle",
            "intensity_avg": {"$avg": "$intensity"},
            "likelihood_avg": {"$avg": "$likelihood"},
            "relevance_avg": {"$avg": "$relevance"},
            "count": {"$sum": 1}
        }},
        {"$sort": {"count": -1}}
    ]
    
    results = list(get_db().insights.aggregate(pipeline))
    
    formatted_results = [
        {
            "pestle": result["_id"],
            "intensity": result["intensity_avg"],
            "likelihood": result["likelihood_avg"],
            "relevance": result["relevance_avg"],
            "count": result["count"]
        } for result in results
    ]
    
    return jsonify(formatted_results)

@api_bp.route('/country-insights', methods=['GET'])
def get_country_insights():
    """Get country-specific insights with filters"""
    country = request.args.get('country')
    
    if not country:
        return jsonify({"error": "Country parameter is required"}), 400
    
    # Get additional filters (besides country which is required)
    match_filter = build_query_filter(request.args)
    
    # Ensure country is set (overriding any filter from build_query_filter)
    match_filter['country'] = country
    
    # MongoDB query with additional filters
    insights = list(get_db().insights.find(
        match_filter,
        {"_id": 0, "title": 1, "insight": 1, "topic": 1, "sector": 1, "intensity": 1, "likelihood": 1, "relevance": 1}
    ).limit(20))
    
    return jsonify(parse_json(insights))
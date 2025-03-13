# import json
# import pandas as pd
# from pymongo import MongoClient
# from app.config import Config

# def import_json_to_mongodb(json_file_path, database_name='dashboard_db', collection_name='insights'):
#     """
#     Import JSON data into MongoDB
    
#     Args:
#         json_file_path (str): Path to the JSON file
#         database_name (str): Name of the MongoDB database
#         collection_name (str): Name of the collection to store the data
    
#     Returns:
#         int: Number of records imported
#     """
#     try:
#         # Connect to MongoDB
#         client = MongoClient(Config.MONGO_URI)
#         db = client[database_name]
#         collection = db[collection_name]
        
#         # Read JSON file
#         with open(json_file_path, 'r', encoding='utf-8') as file:
#             data = json.load(file)
        
#         # Check if collection is empty before importing
#         if collection.count_documents({}) == 0:
#             # Insert data into MongoDB
#             if isinstance(data, list):
#                 collection.insert_many(data)
#                 return len(data)
#             else:
#                 collection.insert_one(data)
#                 return 1
#         else:
#             return 0
    
#     except Exception as e:
#         print(f"Error importing data: {e}")
#         return -1

# def get_unique_values(collection, field):
#     """
#     Get unique values for a specific field in the collection
    
#     Args:
#         collection: MongoDB collection
#         field (str): Field name to get unique values for
    
#     Returns:
#         list: List of unique values
#     """
#     return collection.distinct(field)
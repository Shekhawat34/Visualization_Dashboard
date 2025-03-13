from flask import Flask
from flask_cors import CORS
from app.config import Config
from pymongo import MongoClient

mongo_client = None
db = None

def create_app(config_class=Config):
    app = Flask(__name__)
    app.config.from_object(config_class)
    
    # Enable CORS
    CORS(app)
    
    # Initialize MongoDB
    global mongo_client, db
    mongo_client = MongoClient(app.config['MONGO_URI'])
    # Explicitly specify the database name
    db = mongo_client['dashboard_db']  # Replace with your actual database name
    
    # Import blueprints here (after db is initialized)
    from app.routes.api import api_bp
    
    # Register blueprints
    app.register_blueprint(api_bp, url_prefix='/api')
    
    @app.route('/')
    def index():
        return "Dashboard API is running!"
    
    return app
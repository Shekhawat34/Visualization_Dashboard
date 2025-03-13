import os
import secrets

key= secrets.token_hex(16)
# Load environment variables from .env file if it exists


class Config:
    SECRET_KEY =  key
    MONGO_URI = 'mongodb+srv://lokender:lokender123@cluster0.2vfu4.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0'
    DEBUG = True
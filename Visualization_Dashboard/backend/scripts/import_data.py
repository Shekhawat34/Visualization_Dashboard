# import os
# import sys

# # Add the parent directory to the path to import from app
# sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# from app.utils import import_json_to_mongodb

# if __name__ == "__main__":
#     # Get the absolute path to the JSON file
#     current_dir = os.path.dirname(os.path.abspath(__file__))
#     parent_dir = os.path.dirname(current_dir)
#     json_file_path = os.path.join(parent_dir, 'jsondata.json')
    
#     # Import data into MongoDB
#     count = import_json_to_mongodb(json_file_path)
    
#     if count > 0:
#         print(f"Successfully imported {count} records to MongoDB.")
#     elif count == 0:
#         print("Data already exists in the collection. No data imported.")
#     else:
#         print("An error occurred during import.")
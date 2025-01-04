import pandas as pd
import json
import os

def excel_to_json(input_file, output_file):
    df = pd.read_excel(input_file)
    json_data = df.to_json(orient='records')
    with open(output_file, 'w') as f:
        json.dump(json.loads(json_data), f)
    print(f"Converted {input_file} to {output_file}")

# Create data directory if it doesn't exist
os.makedirs("public/data", exist_ok=True)

# Convert wage data files
for year in range(2017, 2024):
    input_file = f"data/state_M{year}_dl.xlsx"
    output_file = f"public/data/state_M{year}_dl.json"
    if os.path.exists(input_file):
        excel_to_json(input_file, output_file)

# Convert inflation file
if os.path.exists("data/inflation.xlsx"):
    excel_to_json("data/inflation.xlsx", "public/data/inflation.json")
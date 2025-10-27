import os
import psycopg2
from psycopg2.extras import RealDictCursor
from dotenv import load_dotenv
import json

load_dotenv()

DATABASE_URL = os.getenv('DATABASE_URL')

conn = None


def init_db():
    global conn
    if DATABASE_URL is None:
        print('No DATABASE_URL provided, running in memory/mock mode')
        return
    conn = psycopg2.connect(DATABASE_URL)


def save_prediction(result: dict):
    # minimal persistence: insert into predictions table
    if conn is None:
        print('DB not configured - skipping save')
        return
    cur = conn.cursor()
    cur.execute(
        "INSERT INTO predictions (wallet, tx_hash, model_version, score, is_suspicious, explain) VALUES (%s,%s,%s,%s,%s,%s)",
        (result['wallet'], result.get('tx_hash'), result['model_version'], result['score'], result['is_suspicious'], json.dumps(result.get('explain')))
    )
    conn.commit()
    cur.close()

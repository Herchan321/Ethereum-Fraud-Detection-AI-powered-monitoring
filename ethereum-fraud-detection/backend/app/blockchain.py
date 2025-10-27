from web3 import Web3
import os
from dotenv import load_dotenv

load_dotenv()

WEB3_RPC = os.getenv('WEB3_RPC', 'https://rpc.sepolia.org')

w3 = Web3(Web3.HTTPProvider(WEB3_RPC))


def get_tx(tx_hash: str):
    return w3.eth.get_transaction(tx_hash)


def get_tx_receipt(tx_hash: str):
    return w3.eth.get_transaction_receipt(tx_hash)

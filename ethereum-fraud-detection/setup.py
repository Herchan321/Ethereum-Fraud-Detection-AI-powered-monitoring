from setuptools import setup, find_packages

setup(
    name="ethereum_fraud_detection",
    version="0.1",
    packages=find_packages(),
    install_requires=[
        "web3",
        "pandas",
        "numpy",
        "sqlalchemy",
        "scikit-learn",
        "joblib",
    ],
)
from setuptools import setup, find_packages

setup(
    name="ethereum-fraud-detection",
    version="0.1.0",
    packages=find_packages(),
    install_requires=[
        "web3",
        "pandas",
        "numpy",
        "scikit-learn",
        "SQLAlchemy",
        "joblib",
        "websockets",
    ],
    python_requires=">=3.8",
)
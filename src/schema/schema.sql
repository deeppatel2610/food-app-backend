-- PostgreSQL Schema for Users Table

CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    username VARCHAR(100) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL, -- Hashed Password
    age INT,
    weight DECIMAL(5,2),            -- e.g., weight in kg
    height DECIMAL(5,2),            -- e.g., height in cm
    bmi DECIMAL(5,2),               -- Body Mass Index
    blood_group VARCHAR(10),
    health_problem TEXT,
    refresh_token TEXT,
    is_online BOOLEAN DEFAULT FALSE,
    is_delete BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

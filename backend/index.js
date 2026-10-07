import express from 'express';
import app from './src/app/app.js';

// Vercel imports the Express application as a single HTTP Function.
// The persistent Node server remains in src/server.js for local/Docker use.
export default app;

// Keep Express visible to Vercel's framework detection at the entry point.
void express;

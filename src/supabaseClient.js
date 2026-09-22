import { createClient } from '@supabase/supabase-js';

const getEnv = (key) => {
  if (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env[key]) {
    return import.meta.env[key];
  }
  if (typeof process !== 'undefined' && process.env && process.env[key]) {
    return process.env[key];
  }
  return '';
};

const SUPABASE_URL = getEnv('VITE_SUPABASE_URL') || 'https://aasjvnwvlbucqrnipmgh.supabase.co';
const SUPABASE_ANON_KEY = getEnv('VITE_SUPABASE_ANON_KEY') || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFhc2p2bnd2bGJ1Y3FybmlwbWdoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODk3OTg5MjcsImV4cCI6MjEwNTM3NDkyN30.ED_3MO8wHxbdi1QiLLwD-xTjnWS8z4tTf4iC6ukiD8g';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

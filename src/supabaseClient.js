import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'https://aasjvnwvlbucqrnipmgh.supabase.co';
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFhc2p2bnd2bGJ1Y3FybmlwbWdoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODk3OTg5MjcsImV4cCI6MjEwNTM3NDkyN30.ED_3MO8wHxbdi1QiLLwD-xTjnWS8z4tTf4iC6ukiD8g';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

const SUPABASE_URL = 'https://dcbwcxejjxuloanbygfw.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRjYndjeGVqanh1bG9hbmJ5Z2Z3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYzNzg1NzYsImV4cCI6MjA5MTk1NDU3Nn0.PdvOY0nMfCwk8HWg6B_6tkFIxXSVaf7grWrnsQwHkm4';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
export const ADMIN_EMAILS = ['e8318276@gmail.com', 'bundepunemmanuel@gmail.com'];
export const isAdmin = (email) => ADMIN_EMAILS.includes(email?.toLowerCase().trim());
export const FREE_CREDITS = 3;

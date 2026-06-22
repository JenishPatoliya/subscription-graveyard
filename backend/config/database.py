# backend/config/database.py
# Supabase client — replaces config/supabase.js

from supabase import create_client, Client
from config.settings import get_settings

settings = get_settings()

supabase: Client = create_client(
    settings.SUPABASE_URL,
    settings.SUPABASE_SERVICE_KEY
)

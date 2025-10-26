-- Create the interests table for storing user interests
CREATE TABLE IF NOT EXISTS user_interests (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create unique constraint to prevent duplicate interests per user
CREATE UNIQUE INDEX IF NOT EXISTS user_interests_user_name_unique 
ON user_interests(user_id, LOWER(name));

-- Create index for faster queries by user_id
CREATE INDEX IF NOT EXISTS user_interests_user_id_idx 
ON user_interests(user_id);

-- Enable Row Level Security (RLS)
ALTER TABLE user_interests ENABLE ROW LEVEL SECURITY;

-- Create policy to allow users to only access their own interests
CREATE POLICY IF NOT EXISTS "Users can only access their own interests" 
ON user_interests
FOR ALL 
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Create function to update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger to automatically update updated_at
DROP TRIGGER IF EXISTS update_user_interests_updated_at ON user_interests;
CREATE TRIGGER update_user_interests_updated_at 
    BEFORE UPDATE ON user_interests 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Insert some sample data (optional - can be removed if not needed)
-- This will be inserted for the authenticated user when they first log in
-- You can remove this section if you don't want sample data

COMMENT ON TABLE user_interests IS 'Stores learning interests for each user';
COMMENT ON COLUMN user_interests.user_id IS 'Foreign key to auth.users table';
COMMENT ON COLUMN user_interests.name IS 'The name/topic of the interest';
COMMENT ON COLUMN user_interests.created_at IS 'When the interest was added';
COMMENT ON COLUMN user_interests.updated_at IS 'When the interest was last modified';
-- Supabase Schema for History Arrow
-- Run this SQL in your Supabase SQL Editor to set up the database

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create the events table
CREATE TABLE IF NOT EXISTS events (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  start_date DATE NOT NULL,
  end_date DATE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Ensure end_date is after start_date when provided
  CONSTRAINT valid_date_range CHECK (end_date IS NULL OR end_date > start_date)
);

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_events_updated_at
  BEFORE UPDATE ON events
  FOR EACH ROW
  EXECUTE PROCEDURE update_updated_at_column();

-- Create indexes for better query performance
CREATE INDEX idx_events_start_date ON events(start_date);
CREATE INDEX idx_events_end_date ON events(end_date);
CREATE INDEX idx_events_created_at ON events(created_at);

-- Enable Row Level Security (RLS)
ALTER TABLE events ENABLE ROW LEVEL SECURITY;

-- Policy: Anyone can read events (public timeline)
CREATE POLICY "Events are viewable by everyone"
  ON events FOR SELECT
  USING (true);

-- Policy: Only authenticated users can insert events
CREATE POLICY "Authenticated users can insert events"
  ON events FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Policy: Only authenticated users can update events
CREATE POLICY "Authenticated users can update events"
  ON events FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Policy: Only authenticated users can delete events
CREATE POLICY "Authenticated users can delete events"
  ON events FOR DELETE
  TO authenticated
  USING (true);

-- Insert sample data
INSERT INTO events (title, description, start_date, end_date) VALUES
  ('Hadean Eon', 'The earliest eon in Earth''s history, characterized by the formation of the planet and heavy bombardment by asteroids and comets. The name comes from Hades, the Greek god of the underworld.', '4600-01-01 BC', '4000-01-01 BC'),
  ('Invention of the Lightbulb', 'Thomas Edison successfully demonstrated his incandescent light bulb on October 21, 1879, revolutionizing the way humans illuminate their world and ushering in the age of electric lighting.', '1879-10-21', NULL),
  ('World War II', 'A global conflict that lasted from 1939 to 1945, involving most of the world''s nations divided into two opposing military alliances: the Allies and the Axis powers.', '1939-09-01', '1945-09-02'),
  ('Moon Landing', 'Apollo 11 astronauts Neil Armstrong and Buzz Aldrin became the first humans to walk on the Moon on July 20, 1969, while Michael Collins orbited above in the command module.', '1969-07-20', NULL),
  ('Renaissance Period', 'A cultural movement that began in Italy and spread throughout Europe, marking the transition from the medieval period to modernity. It saw extraordinary flourishing in art, architecture, literature, and science.', '1400-01-01', '1600-01-01'),
  ('Industrial Revolution', 'The transition to new manufacturing processes in Britain and later worldwide, fundamentally changing economy and society through mechanization, factory systems, and urbanization.', '1760-01-01', '1840-01-01'),
  ('Fall of the Roman Empire', 'The gradual decline and fall of the Western Roman Empire, traditionally dated to 476 AD when the last Roman emperor Romulus Augustulus was deposed.', '0476-09-04', NULL),
  ('Age of Exploration', 'A period of European global exploration that began in the early 15th century and continued into the early 17th century, during which Europeans explored Africa, the Americas, Asia, and Oceania.', '1400-01-01', '1600-01-01');

-- Grant permissions for the service role
GRANT ALL ON events TO service_role;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO service_role;

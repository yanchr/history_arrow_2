-- Supabase Schema for History Arrow
-- Run this SQL in your Supabase SQL Editor to set up the database

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create the events table
CREATE TABLE IF NOT EXISTS events (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  
  -- Date type: 'date' for precise calendar dates, 'astronomical' for years ago
  date_type VARCHAR(20) DEFAULT 'date' CHECK (date_type IN ('date', 'astronomical')),
  
  -- For precise calendar dates (date_type = 'date')
  start_date DATE,
  end_date DATE,
  
  -- For astronomical dates (date_type = 'astronomical')
  -- Stored as positive BIGINT representing years ago from present
  astronomical_start_year BIGINT,
  astronomical_end_year BIGINT,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Ensure end_date is after start_date when provided (for date type)
  CONSTRAINT valid_date_range CHECK (
    date_type != 'date' OR end_date IS NULL OR end_date > start_date
  ),
  
  -- Ensure astronomical years are positive and start > end (further in past)
  CONSTRAINT valid_astronomical_range CHECK (
    date_type != 'astronomical' OR 
    (astronomical_start_year > 0 AND (astronomical_end_year IS NULL OR astronomical_start_year > astronomical_end_year))
  ),
  
  -- Ensure required fields based on date_type
  CONSTRAINT required_date_fields CHECK (
    (date_type = 'date' AND start_date IS NOT NULL) OR
    (date_type = 'astronomical' AND astronomical_start_year IS NOT NULL)
  )
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
CREATE INDEX idx_events_date_type ON events(date_type);
CREATE INDEX idx_events_astronomical_start ON events(astronomical_start_year);
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

-- Astronomical events (billions/millions of years ago)
INSERT INTO events (title, description, date_type, astronomical_start_year, astronomical_end_year) VALUES
  ('Formation of Earth', 'The Earth formed approximately 4.54 billion years ago by accretion from the solar nebula. The early Earth was molten due to extreme volcanism and frequent collisions with other bodies.', 'astronomical', 4540000000, NULL),
  ('Hadean Eon', 'The earliest eon in Earth''s history, characterized by the formation of the planet and heavy bombardment by asteroids and comets. The name comes from Hades, the Greek god of the underworld.', 'astronomical', 4600000000, 4000000000),
  ('Great Oxygenation Event', 'Cyanobacteria began producing oxygen through photosynthesis, dramatically changing Earth''s atmosphere and enabling the evolution of aerobic life forms.', 'astronomical', 2400000000, 2000000000),
  ('Cambrian Explosion', 'A period of rapid evolutionary diversification when most major animal phyla appeared in the fossil record. This event fundamentally shaped the tree of life.', 'astronomical', 538000000, 485000000),
  ('Extinction of Dinosaurs', 'The Cretaceous-Paleogene extinction event caused by an asteroid impact, leading to the extinction of non-avian dinosaurs and many other species.', 'astronomical', 66000000, NULL);

-- Calendar date events (precise dates)
INSERT INTO events (title, description, date_type, start_date, end_date) VALUES
  ('Invention of the Lightbulb', 'Thomas Edison successfully demonstrated his incandescent light bulb on October 21, 1879, revolutionizing the way humans illuminate their world and ushering in the age of electric lighting.', 'date', '1879-10-21', NULL),
  ('World War II', 'A global conflict that lasted from 1939 to 1945, involving most of the world''s nations divided into two opposing military alliances: the Allies and the Axis powers.', 'date', '1939-09-01', '1945-09-02'),
  ('Moon Landing', 'Apollo 11 astronauts Neil Armstrong and Buzz Aldrin became the first humans to walk on the Moon on July 20, 1969, while Michael Collins orbited above in the command module.', 'date', '1969-07-20', NULL),
  ('Renaissance Period', 'A cultural movement that began in Italy and spread throughout Europe, marking the transition from the medieval period to modernity. It saw extraordinary flourishing in art, architecture, literature, and science.', 'date', '1400-01-01', '1600-01-01'),
  ('Industrial Revolution', 'The transition to new manufacturing processes in Britain and later worldwide, fundamentally changing economy and society through mechanization, factory systems, and urbanization.', 'date', '1760-01-01', '1840-01-01'),
  ('Fall of the Roman Empire', 'The gradual decline and fall of the Western Roman Empire, traditionally dated to 476 AD when the last Roman emperor Romulus Augustulus was deposed.', 'date', '0476-09-04', NULL),
  ('Age of Exploration', 'A period of European global exploration that began in the early 15th century and continued into the early 17th century, during which Europeans explored Africa, the Americas, Asia, and Oceania.', 'date', '1400-01-01', '1600-01-01');

-- Grant permissions for the service role
GRANT ALL ON events TO service_role;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO service_role;

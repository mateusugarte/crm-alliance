-- Controla envio unico do PDF de apresentacao do La Reserva por lead
ALTER TABLE leads ADD COLUMN IF NOT EXISTS pdf_enviado boolean DEFAULT false;

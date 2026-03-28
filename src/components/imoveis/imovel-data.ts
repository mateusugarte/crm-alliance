export interface ImovelMock {
  id: string
  nome: string
  metragem: number
  quartos: number
  suites: number
  diferenciais: string[]
  valor_min: number
  valor_max: number
  disponivel: boolean
}

export const IMOVEIS_LA_RESERVA: ImovelMock[] = [
  {
    id: 'apto-01',
    nome: 'Apartamento 01',
    metragem: 146,
    quartos: 3,
    suites: 3,
    diferenciais: ['Frente para o mar', 'Varanda gourmet', 'Suíte máster com closet', 'Área de serviço'],
    valor_min: 1800000,
    valor_max: 2100000,
    disponivel: true,
  },
  {
    id: 'apto-02',
    nome: 'Apartamento 02',
    metragem: 90.80,
    quartos: 2,
    suites: 2,
    diferenciais: ['Vista lateral mar', 'Varanda integrada', 'Área de serviço'],
    valor_min: 1100000,
    valor_max: 1350000,
    disponivel: true,
  },
  {
    id: 'apto-03',
    nome: 'Apartamento 03',
    metragem: 110.85,
    quartos: 3,
    suites: 2,
    diferenciais: ['Vista para o jardim', 'Varanda gourmet', 'Área de serviço'],
    valor_min: 1300000,
    valor_max: 1550000,
    disponivel: false,
  },
  {
    id: 'apto-04',
    nome: 'Apartamento 04',
    metragem: 144.80,
    quartos: 3,
    suites: 3,
    diferenciais: ['Vista panorâmica', 'Varanda gourmet', 'Suíte máster com closet'],
    valor_min: 1750000,
    valor_max: 2050000,
    disponivel: true,
  },
  {
    id: 'cob-01',
    nome: 'Cobertura 01',
    metragem: 245.60,
    quartos: 4,
    suites: 4,
    diferenciais: ['Vista 360°', 'Piscina privativa', 'Terraço gourmet', 'Closet no quarto máster', 'Área de serviço completa'],
    valor_min: 3500000,
    valor_max: 4200000,
    disponivel: true,
  },
  {
    id: 'cob-02',
    nome: 'Cobertura 02',
    metragem: 259.95,
    quartos: 4,
    suites: 4,
    diferenciais: ['Vista frontal mar', 'Piscina privativa', 'Terraço duplo', 'Closet duplo', 'Home theater'],
    valor_min: 3800000,
    valor_max: 4600000,
    disponivel: false,
  },
]

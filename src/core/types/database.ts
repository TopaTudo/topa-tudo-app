export type ProfileRole = 'adm' | 'tecnico';
export type OrderStatus = 'orcamento' | 'agendado' | 'em_andamento' | 'concluido' | 'cancelado';
export type InventoryMovementType = 'entrada' | 'saida';
export type OrderItemSource = 'estoque' | 'comprado';
export type TransactionType = 'receita' | 'despesa';
export type TransactionStatus = 'confirmado' | 'pendente';
export type ToolStatus = 'disponivel' | 'emprestada' | 'manutencao';

export interface Profile {
  id: string;
  name: string;
  pin?: string;
  role: ProfileRole;
  active: boolean;
  created_at: string;
}

export interface Client {
  id: string;
  name: string;
  phone: string | null;
  address: string | null;
  notes: string | null;
  created_at: string;
}

export interface ServiceCatalogItem {
  id: string;
  title: string;
  category: string | null;
  default_price: number;
  created_at: string;
}

export interface InventoryItem {
  id: string;
  code: string | null;
  name: string;
  category: string | null;
  unit: string;
  min_stock: number;
  max_stock: number;
  cost_price: number;
  supplier: string | null;
  notes: string | null;
  created_at: string;
}

export interface InventoryStockView {
  id: string;
  code: string | null;
  name: string;
  category: string | null;
  unit: string;
  min_stock: number;
  max_stock: number;
  cost_price: number;
  supplier: string | null;
  notes: string | null;
  created_at: string;
  entradas: number;
  saidas: number;
  saldo_atual: number;
}

export interface InventoryMovement {
  id: string;
  material_id: string;
  type: InventoryMovementType;
  quantity: number;
  order_id: string | null;
  notes: string | null;
  created_at: string;
  // joined fields
  material?: InventoryItem;
}

export interface Order {
  id: string;
  code: number;
  client_id: string | null;
  tech_id: string | null;
  status: OrderStatus;
  address: string | null;
  description: string | null;
  total_price: number;
  payment_method: string | null;
  warranty_days: number;
  photos_before: string[];
  photos_after: string[];
  scheduled_at: string | null;
  completed_at: string | null;
  created_at: string;
  // joined fields
  client?: Client;
  tech?: Profile;
}

export interface OrderItem {
  id: string;
  order_id: string;
  material_id: string | null;
  name: string;
  quantity: number;
  unit_cost: number;
  source: OrderItemSource;
}

export interface Transaction {
  id: string;
  type: TransactionType;
  amount: number;
  description: string;
  category: string | null;
  status: TransactionStatus;
  order_id: string | null;
  attachment_url: string | null;
  date: string;
  created_at: string;
}

export interface Tool {
  id: string;
  code: string | null;
  name: string;
  category: string | null;
  status: ToolStatus;
  assigned_to_tech_id: string | null;
  notes: string | null;
  updated_at: string;
  // joined fields
  assigned_tech?: Profile;
}

export interface ScheduleItem {
  id: string;
  date: string; // YYYY-MM-DD
  start_time: string | null;
  end_time: string | null;
  client_id: string;
  tech_id: string | null;
  description: string | null;
  status: string;
  created_at: string;
  // joined fields
  client?: Client;
  tech?: Profile;
}

export interface CompleteOrderResult {
  success: boolean;
  message?: string;
  order_id: string;
  items_deducted: number;
  transaction_created: boolean;
}

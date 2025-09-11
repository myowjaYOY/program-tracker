// Common base types for entity management

export interface BaseEntity {
  id: string;
  active_flag: boolean;
  created_at: string;
  updated_at: string;
}

export interface EntityFormProps<T> {
  initialValues?: T;
  onSubmit: (values: T) => Promise<void>;
  isLoading?: boolean;
}

export interface EntityTableProps<T> {
  data: T[];
  isLoading?: boolean;
  onEdit?: (row: T) => void;
  onDelete?: (row: T) => void;
}

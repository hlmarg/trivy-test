export interface GenericResponse<T> {
  success: boolean;
  message: string;
  data: T;
}

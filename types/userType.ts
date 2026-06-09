export type TUser = {
  id?: string;
  name: string | null;
  email: string;
  image?: string | null;
  password?: string;
  createdAt?: Date;
  updatedAt?: Date;
};

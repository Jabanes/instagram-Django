export interface User {
    username: string;
    email: string;
    first_name: string;
    last_name: string;
    last_login: string | null;
    date_joined: string;
    roles: string[]; // adjust if roles are objects instead of strings
  }
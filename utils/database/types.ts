export interface Role {
  id: number;
  name: string;
}

export interface Company {
  id: number;
  name: string;
  description: string;
}

export interface User {
  id: number;
  username: string;
  password: string;
  isAdmin: boolean;
  active: boolean;
  roles?: Role[];
  companies?: Company[];
}

export interface Visit {
  id: number;
  user_id: number;
  company_id: number;
  role_id: number;
  start_time: string;
  end_time: string | null;
  duration: number | null;
  latitude: number | null;
  longitude: number | null;
  no_gps_signal: boolean;
  end_latitude: number | null;
  end_longitude: number | null;
  no_gps_signal_end: boolean;
}

export interface VisitReport {
  user_id: number;
  username: string;
  company_id: number;
  company_name: string;
  total_duration: number;
  visits: {
    start_time: string;
    end_time: string;
    duration: number;
    start_latitude: number | null;
    start_longitude: number | null;
    no_gps_signal_start: boolean;
    end_latitude: number | null;
    end_longitude: number | null;
    no_gps_signal_end: boolean;
  }[];
}
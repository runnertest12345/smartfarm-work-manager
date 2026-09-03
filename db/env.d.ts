declare namespace NodeJS {
  interface ProcessEnv {
    DATABASE_URL?: string;
    INSTANCE_CONNECTION_NAME?: string;
    PGHOST?: string;
    PGPORT?: string;
    PGUSER?: string;
    PGPASSWORD?: string;
    PGDATABASE?: string;
    PGSSLMODE?: string;
    DB_POOL_MAX?: string;
    ENABLE_SAMPLE_DATA?: string;
    ALLOWED_EMAIL_DOMAIN?: string;
    IAP_AUDIENCE?: string;
    SITE_URL?: string;
  }
}

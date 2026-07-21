import mysql from "mysql2/promise";

const port = Number(process.env.MYSQL_PORT ?? 3306);

export const db = mysql.createPool({
  host: process.env.MYSQL_HOST,
  port,
  database: process.env.MYSQL_DATABASE,
  user: process.env.MYSQL_USER,
  password: process.env.MYSQL_PASSWORD,
  supportBigNumbers: true,
  bigNumberStrings: true,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

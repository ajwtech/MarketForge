export default ({ env }) => ({
	connection: {
		client: 'mysql',
		connection: {
		host: env('DATABASE_HOST', 'marketingstackmysql.mysql.database.azure.com'),
			port: env.int('DATABASE_PORT', 3306),
			database: env('DATABASE_NAME', 'strapi'),
			user: env('DATABASE_USERNAME', 'mysqladmin'),
			password: env('DATABASE_PASSWORD', 'Market!ngMysqlAdminPass'),
			ssl: env.bool('DATABASE_SSL', false)
		}
	}
});

using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;

namespace DbHelper;

public static class DbExtensions
{
    /// <summary>
    /// Dang ky DbContext voi MariaDB/XAMPP qua Pomelo + AuditInterceptor.
    /// Target local: MariaDB 10.4.32.
    /// </summary>
    public static IServiceCollection AddMariaDb<TContext>(
        this IServiceCollection services,
        IConfiguration config,
        string connectionStringName = "DefaultConnection")
        where TContext : DbContext
    {
        var connectionString = config.GetConnectionString(connectionStringName)
            ?? throw new InvalidOperationException($"Connection string '{connectionStringName}' not found");

        var serverVersion = new MariaDbServerVersion(new Version(10, 4, 32));

        services.AddDbContext<TContext>(options =>
        {
            options.UseMySql(connectionString, serverVersion);
            options.AddInterceptors(new AuditInterceptor());
        });

        return services;
    }
}

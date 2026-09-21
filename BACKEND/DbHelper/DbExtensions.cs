using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;

namespace DbHelper;

/// <summary>
/// Extension methods de dang ky DbContext trong Program.cs
/// </summary>
public static class DbExtensions
{
    /// <summary>
    /// Dang ky DbContext voi MySQL + AuditInterceptor
    /// Usage: builder.Services.AddMySqlDb&lt;MyDbContext&gt;(config);
    /// </summary>
    public static IServiceCollection AddMySqlDb<TContext>(
        this IServiceCollection services,
        IConfiguration config,
        string connectionStringName = "DefaultConnection")
        where TContext : DbContext
    {
        var connectionString = config.GetConnectionString(connectionStringName)
            ?? throw new InvalidOperationException($"Connection string '{connectionStringName}' not found");

        services.AddDbContext<TContext>(options =>
        {
            options.UseMySQL(connectionString);
            options.AddInterceptors(new AuditInterceptor());
        });

        return services;
    }
}

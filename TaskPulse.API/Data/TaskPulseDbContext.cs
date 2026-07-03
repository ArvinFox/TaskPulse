using Microsoft.EntityFrameworkCore;
using TaskPulse.API.Models;

namespace TaskPulse.API.Data;

/// <summary>
/// The Entity Framework Core Database Context.
/// It bridges our C# classes (Entities) and the SQLite Database.
/// Inherits from DbContext.
/// </summary>
public class TaskPulseDbContext : DbContext
{
    // Constructor receiving DbContextOptions (configured in Program.cs) and passing it to base.
    public TaskPulseDbContext(DbContextOptions<TaskPulseDbContext> options) : base(options)
    {
    }

    // DbSet properties represent the tables in our database.
    public DbSet<BoardProject> Projects => Set<BoardProject>();
    public DbSet<TeamMember> TeamMembers => Set<TeamMember>();
    public DbSet<TaskItem> Tasks => Set<TaskItem>();
    public DbSet<SubTaskItem> SubTasks => Set<SubTaskItem>();

    /// <summary>
    /// Configures the database schema and defines seed data during database creation.
    /// </summary>
    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        // Configure relationships and delete behaviors using EF Fluent API
        
        // Project to Tasks (One-to-Many)
        modelBuilder.Entity<TaskItem>()
            .HasOne(t => t.Project)
            .WithMany(p => p.Tasks)
            .HasForeignKey(t => t.ProjectId)
            .OnDelete(DeleteBehavior.Cascade); // If project is deleted, delete its tasks

        // TeamMember to Tasks (One-to-Many, Nullable relationship)
        modelBuilder.Entity<TaskItem>()
            .HasOne(t => t.AssignedMember)
            .WithMany(m => m.Tasks)
            .HasForeignKey(t => t.AssignedMemberId)
            .OnDelete(DeleteBehavior.SetNull); // Keep task, clear assigned member if member is deleted

        // Task to SubTasks (One-to-Many)
        modelBuilder.Entity<SubTaskItem>()
            .HasOne(s => s.TaskItem)
            .WithMany(t => t.SubTasks)
            .HasForeignKey(s => s.TaskItemId)
            .OnDelete(DeleteBehavior.Cascade); // Delete subtasks when task is deleted

        // --- SEED DATA ---
        // Seeding allows the database to start with ready-to-use information.
        // Seed Board Projects
        modelBuilder.Entity<BoardProject>().HasData(
            new BoardProject { Id = 1, Name = "Workspace Board", Description = "Interactive Task Board" }
        );

        // Seed Team Members
        modelBuilder.Entity<TeamMember>().HasData(
            new TeamMember { Id = 1, Name = "Sarah Connor", Role = "Product Manager", AvatarUrl = "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150" },
            new TeamMember { Id = 2, Name = "John Doe", Role = "Senior DotNet Engineer", AvatarUrl = "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150" },
            new TeamMember { Id = 3, Name = "Alice Vance", Role = "Angular UI Specialist", AvatarUrl = "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=150" },
            new TeamMember { Id = 4, Name = "Marcus Aurelius", Role = "System Architect", AvatarUrl = "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150" }
        );
    }
}

using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
using TaskPulse.API.Data;
using TaskPulse.API.Hubs;
using TaskPulse.API.Models;

var builder = WebApplication.CreateBuilder(args);

// --- DEPENDENCY INJECTION CONTAINER ---
// This is where we register our services. .NET handles their lifecycle automatically.

// 1. Register EF Core DbContext dynamically (PostgreSQL in production/cloud, SQLite locally).
var connectionString = builder.Configuration.GetConnectionString("DefaultConnection") ?? "Data Source=taskpulse.db";
builder.Services.AddDbContext<TaskPulseDbContext>(options =>
{
    if (connectionString.StartsWith("Host=") || connectionString.Contains("postgres") || connectionString.Contains("Postgres"))
    {
        options.UseNpgsql(connectionString);
    }
    else
    {
        options.UseSqlite(connectionString);
    }
});

// 2. Register SignalR Services for real-time WebSocket communication.
builder.Services.AddSignalR();

// 3. Register standard service dependencies.

// 4. Configure CORS (Cross-Origin Resource Sharing).
// Because our Angular app runs on a different port (http://localhost:4200),
// we must explicitly allow it to make HTTP requests and open WebSocket connections.
builder.Services.AddCors(options =>
{
    options.AddPolicy("CorsPolicy", policy =>
    {
        policy.WithOrigins("http://localhost:4200") // Angular default port
              .AllowAnyHeader()
              .AllowAnyMethod()
              .AllowCredentials(); // Required for SignalR WebSockets
    });
});

builder.Services.AddOpenApi();

var app = builder.Build();

// --- HTTP REQUEST PIPELINE (MIDDLEWARE) ---
// Configures how HTTP requests flow through the application.

if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
}

app.UseCors("CorsPolicy");

// Ensure the database is created, schema is set up, and seeds are populated on startup.
using (var scope = app.Services.CreateScope())
{
    var context = scope.ServiceProvider.GetRequiredService<TaskPulseDbContext>();
    // EnsureCreated() creates the DB and schema if they don't exist, and runs seed data configurations.
    context.Database.EnsureCreated();
}

// --- MINIMAL API ENDPOINTS ---

// Map the SignalR Hub. This sets up WebSocket listener on the "/hubs/tasks" route.
app.MapHub<TaskHub>("/hubs/tasks");

// Project endpoints
app.MapGet("/api/projects", async (TaskPulseDbContext db) =>
{
    return await db.Projects.ToListAsync();
});

// Get all tasks for a project, including Subtasks and Assigned Members
app.MapGet("/api/projects/{projectId:int}/tasks", async (int projectId, TaskPulseDbContext db) =>
{
    var tasks = await db.Tasks
        .Where(t => t.ProjectId == projectId)
        .Include(t => t.AssignedMember)
        .Include(t => t.SubTasks)
        .ToListAsync();
    return Results.Ok(tasks);
});

// Create a new task
app.MapPost("/api/tasks", async ([FromBody] TaskItem task, TaskPulseDbContext db, IHubContext<TaskHub> hubContext) =>
{
    // Validate foreign keys
    var projectExists = await db.Projects.AnyAsync(p => p.Id == task.ProjectId);
    if (!projectExists) return Results.BadRequest("Invalid Project ID.");

    if (task.AssignedMemberId.HasValue)
    {
        var memberExists = await db.TeamMembers.AnyAsync(m => m.Id == task.AssignedMemberId.Value);
        if (!memberExists) return Results.BadRequest("Invalid Member ID.");
    }

    db.Tasks.Add(task);
    await db.SaveChangesAsync();

    // Reload task with relationships to return complete details
    var createdTask = await db.Tasks
        .Include(t => t.AssignedMember)
        .Include(t => t.SubTasks)
        .FirstAsync(t => t.Id == task.Id);

    // Notify other clients via SignalR
    await hubContext.Clients.All.SendAsync("TaskCreated", createdTask);

    return Results.Created($"/api/tasks/{task.Id}", createdTask);
});

// Update an existing task (title, description, points, member)
app.MapPut("/api/tasks/{id:int}", async (int id, [FromBody] TaskItem updatedTask, TaskPulseDbContext db, IHubContext<TaskHub> hubContext) =>
{
    var task = await db.Tasks.Include(t => t.SubTasks).FirstOrDefaultAsync(t => t.Id == id);
    if (task == null) return Results.NotFound();

    task.Title = updatedTask.Title;
    task.Description = updatedTask.Description;
    task.StoryPoints = updatedTask.StoryPoints;
    task.AssignedMemberId = updatedTask.AssignedMemberId;
    task.ColumnStatus = updatedTask.ColumnStatus;

    // Check if subtasks are updated or provided
    if (updatedTask.SubTasks != null && updatedTask.SubTasks.Any())
    {
        // Simple checklist updates: delete existing subtasks and re-add or sync.
        // For simplicity in this demo, we'll sync subtasks.
        db.SubTasks.RemoveRange(task.SubTasks);
        foreach (var sub in updatedTask.SubTasks)
        {
            task.SubTasks.Add(new SubTaskItem
            {
                Title = sub.Title,
                IsCompleted = sub.IsCompleted,
                TaskItemId = id
            });
        }
    }

    await db.SaveChangesAsync();

    // Load full details for broadcast
    var fullTask = await db.Tasks
        .Include(t => t.AssignedMember)
        .Include(t => t.SubTasks)
        .FirstAsync(t => t.Id == id);

    // Broadcast update
    await hubContext.Clients.All.SendAsync("TaskUpdated", fullTask);

    return Results.Ok(fullTask);
});

// Move a task status (Optimized light endpoint specifically for Drag & Drop actions)
app.MapPut("/api/tasks/{id:int}/move", async (int id, [FromBody] string newStatus, TaskPulseDbContext db, IHubContext<TaskHub> hubContext) =>
{
    var validStatuses = new[] { "ToDo", "InProgress", "InReview", "Done" };
    if (!validStatuses.Contains(newStatus)) return Results.BadRequest("Invalid column status.");

    var task = await db.Tasks.FindAsync(id);
    if (task == null) return Results.NotFound();

    task.ColumnStatus = newStatus;
    await db.SaveChangesAsync();

    // Broadcast move to all client views EXCEPT the client who dragged the task (handled client side)
    // To identify who initiated, the client sends connection info, but standard SendAsync works.
    await hubContext.Clients.All.SendAsync("TaskMoved", id, newStatus);

    return Results.Ok(new { TaskId = id, Status = newStatus });
});

// Delete a task
app.MapDelete("/api/tasks/{id:int}", async (int id, TaskPulseDbContext db, IHubContext<TaskHub> hubContext) =>
{
    var task = await db.Tasks.FindAsync(id);
    if (task == null) return Results.NotFound();

    db.Tasks.Remove(task);
    await db.SaveChangesAsync();

    // Broadcast delete to all clients
    await hubContext.Clients.All.SendAsync("TaskDeleted", id);

    return Results.NoContent();
});

// Get team members list
app.MapGet("/api/members", async (TaskPulseDbContext db) =>
{
    return await db.TeamMembers.ToListAsync();
});

app.Run();

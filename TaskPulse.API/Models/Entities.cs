using System.Text.Json.Serialization;

namespace TaskPulse.API.Models;

/// <summary>
/// Represents a workspace board or project.
/// This acts as the root container for our tasks and team members.
/// </summary>
public class BoardProject
{
    // Primary key for the database.
    public int Id { get; set; }

    // Required project name. In modern C# (C# 8+ / .NET 6+), non-nullable reference types 
    // must be initialized. Using "required" modifier forces initialization during object creation.
    public required string Name { get; set; }

    public string? Description { get; set; }

    // Navigation property: Defines a One-to-Many relationship (One Project has Many Tasks).
    // JsonIgnore prevents infinite reference loops during JSON serialization.
    [JsonIgnore]
    public ICollection<TaskItem> Tasks { get; set; } = new List<TaskItem>();
}

/// <summary>
/// Represents a team member who can be assigned tasks.
/// </summary>
public class TeamMember
{
    public int Id { get; set; }

    public required string Name { get; set; }

    public required string Role { get; set; }

    public required string AvatarUrl { get; set; }

    // Navigation property: One team member can have many tasks assigned.
    [JsonIgnore]
    public ICollection<TaskItem> Tasks { get; set; } = new List<TaskItem>();
}

/// <summary>
/// Represents a task item inside our Kanban board.
/// </summary>
public class TaskItem
{
    public int Id { get; set; }

    public required string Title { get; set; }

    public string? Description { get; set; }

    // Column status: "ToDo", "InProgress", "InReview", "Done"
    public required string ColumnStatus { get; set; }

    // Scrum Story Points indicating task effort/complexity (e.g., 1, 2, 3, 5, 8)
    public int StoryPoints { get; set; }

    // Foreign Key: A task belongs to one project.
    public int ProjectId { get; set; }

    // Navigation property: Points to the project container.
    [JsonIgnore]
    public BoardProject? Project { get; set; }

    // Foreign Key: A task can be assigned to a team member (optional/nullable).
    public int? AssignedMemberId { get; set; }

    // Navigation property: Points to the assigned member.
    public TeamMember? AssignedMember { get; set; }

    // Navigation property: A task can have multiple subtasks/checklist items.
    public ICollection<SubTaskItem> SubTasks { get; set; } = new List<SubTaskItem>();
}

/// <summary>
/// Represents a checklist subtask inside a larger TaskItem.
/// </summary>
public class SubTaskItem
{
    public int Id { get; set; }

    public required string Title { get; set; }

    public bool IsCompleted { get; set; }

    // Foreign Key pointing back to the parent TaskItem.
    public int TaskItemId { get; set; }

    // Navigation property: Points to the parent Task.
    // JsonIgnore is vital here to stop loops where Task contains SubTask, which contains Task.
    [JsonIgnore]
    public TaskItem? TaskItem { get; set; }
}

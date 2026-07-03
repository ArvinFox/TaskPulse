using Microsoft.AspNetCore.SignalR;

namespace TaskPulse.API.Hubs;

/// <summary>
/// SignalR Hub for real-time TaskPulse notifications.
/// Under the hood, SignalR manages WebSockets (or fallbacks) automatically.
/// This Hub acts as a pub/sub server where clients subscribe to notifications.
/// 
/// We implement standard hubs that allow clients to broadcast activities.
/// Note: In production apps, we do database edits via REST APIs first, 
/// and then inject the Hub Context into the APIs to broadcast updates to other clients.
/// </summary>
public class TaskHub : Hub
{
    /// <summary>
    /// Broadcasts that a task was moved to a different column.
    /// Other connected clients can listen to "TaskMoved" and update their UI instantly.
    /// </summary>
    public async Task NotifyTaskMoved(int taskId, string newColumnStatus, string movedBy)
    {
        // Clients.Others sends this to all connected clients EXCEPT the client who sent it.
        // This avoids double-updating the sender's UI.
        await Clients.Others.SendAsync("TaskMoved", taskId, newColumnStatus, movedBy);
    }

    /// <summary>
    /// Broadcasts that a task was updated (title, description, subtasks etc.).
    /// </summary>
    public async Task NotifyTaskUpdated(int taskId, string title, string updatedBy)
    {
        await Clients.Others.SendAsync("TaskUpdated", taskId, title, updatedBy);
    }

    /// <summary>
    /// Broadcasts that a task was created.
    /// </summary>
    public async Task NotifyTaskCreated(int taskId, string title, string createdBy)
    {
        await Clients.All.SendAsync("TaskCreated", taskId, title, createdBy);
    }

    /// <summary>
    /// Broadcasts that a task was deleted.
    /// </summary>
    public async Task NotifyTaskDeleted(int taskId, string title, string deletedBy)
    {
        await Clients.Others.SendAsync("TaskDeleted", taskId, title, deletedBy);
    }
}

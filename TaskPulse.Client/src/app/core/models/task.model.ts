export interface BoardProject {
  id: number;
  name: string;
  description?: string;
}

export interface TeamMember {
  id: number;
  name: string;
  role: string;
  avatarUrl: string;
}

export interface SubTaskItem {
  id?: number;
  title: string;
  isCompleted: boolean;
  taskItemId?: number;
}

export interface TaskItem {
  id?: number;
  title: string;
  description?: string;
  columnStatus: 'ToDo' | 'InProgress' | 'InReview' | 'Done';
  storyPoints: number;
  projectId: number;
  assignedMemberId?: number | null;
  assignedMember?: TeamMember | null;
  subTasks: SubTaskItem[];
}

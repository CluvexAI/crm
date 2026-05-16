const STORAGE_KEY = 'zsm_crm_projects';

const getStorage = () => {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || null;
  } catch (e) {
    console.error('[ProjectsDB] Error reading:', e);
    return null;
  }
};

const setStorage = (data) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    return true;
  } catch (e) {
    console.error('[ProjectsDB] Error writing:', e);
    return false;
  }
};

export const initializeProjectsDatabase = (defaultProjects) => {
  const stored = getStorage();
  if (stored) {
    console.log('[ProjectsDB] Loaded', stored.length, 'projects from storage');
    return stored;
  }
  console.log('[ProjectsDB] Initializing with default projects');
  setStorage(defaultProjects);
  return defaultProjects;
};

export const getAllProjects = () => getStorage() || [];

export const getProjectById = (id) => {
  const projects = getStorage();
  return projects?.find(p => p.id === id) || null;
};

export const createProjectRecord = (projectData) => {
  const projects = getStorage() || [];
  const newProject = {
    ...projectData,
    id: projectData.id || Date.now(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    version: 1
  };
  projects.push(newProject);
  setStorage(projects);
  console.log('[ProjectsDB] Created project:', newProject.id);
  return newProject;
};

export const updateProjectRecord = (id, projectData) => {
  const projects = getStorage() || [];
  const index = projects.findIndex(p => p.id === id);
  
  if (index === -1) {
    console.error('[ProjectsDB] Project not found:', id);
    throw new Error('Project not found');
  }
  
  const currentProject = projects[index];
  const updatedProject = {
    ...currentProject,
    ...projectData,
    updatedAt: new Date().toISOString(),
    version: (currentProject.version || 0) + 1
  };
  
  projects[index] = updatedProject;
  setStorage(projects);
  console.log('[ProjectsDB] Updated project:', id, 'version:', updatedProject.version);
  
  return updatedProject;
};

export const deleteProjectRecord = (id) => {
  const projects = getStorage() || [];
  const filtered = projects.filter(p => p.id !== id);
  setStorage(filtered);
  console.log('[ProjectsDB] Deleted project:', id);
  return true;
};

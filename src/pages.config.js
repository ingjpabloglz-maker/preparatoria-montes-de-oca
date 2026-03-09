/**
 * pages.config.js - Page routing configuration
 * 
 * This file is AUTO-GENERATED. Do not add imports or modify PAGES manually.
 * Pages are auto-registered when you create files in the ./pages/ folder.
 * 
 * THE ONLY EDITABLE VALUE: mainPage
 * This controls which page is the landing page (shown when users visit the app).
 * 
 * Example file structure:
 * 
 *   import HomePage from './pages/HomePage';
 *   import Dashboard from './pages/Dashboard';
 *   import Settings from './pages/Settings';
 *   
 *   export const PAGES = {
 *       "HomePage": HomePage,
 *       "Dashboard": Dashboard,
 *       "Settings": Settings,
 *   }
 *   
 *   export const pagesConfig = {
 *       mainPage: "HomePage",
 *       Pages: PAGES,
 *   };
 * 
 * Example with Layout (wraps all pages):
 *
 *   import Home from './pages/Home';
 *   import Settings from './pages/Settings';
 *   import __Layout from './Layout.jsx';
 *
 *   export const PAGES = {
 *       "Home": Home,
 *       "Settings": Settings,
 *   }
 *
 *   export const pagesConfig = {
 *       mainPage: "Home",
 *       Pages: PAGES,
 *       Layout: __Layout,
 *   };
 *
 * To change the main page from HomePage to Dashboard, use find_replace:
 *   Old: mainPage: "HomePage",
 *   New: mainPage: "Dashboard",
 *
 * The mainPage value must match a key in the PAGES object exactly.
 */
import AdminDashboard from './pages/AdminDashboard';
import CourseMap from './pages/CourseMap';
import Dashboard from './pages/Dashboard';
import Lesson from './pages/Lesson';
import Level from './pages/Level';
import ManageAdmins from './pages/ManageAdmins';
import ManageFolios from './pages/ManageFolios';
import ManageStudents from './pages/ManageStudents';
import ManageSubjects from './pages/ManageSubjects';
import Profile from './pages/Profile';
import StudentDetail from './pages/StudentDetail';
import Subject from './pages/Subject';
import UnlockLevel from './pages/UnlockLevel';
import __Layout from './Layout.jsx';


export const PAGES = {
    "AdminDashboard": AdminDashboard,
    "CourseMap": CourseMap,
    "Dashboard": Dashboard,
    "Lesson": Lesson,
    "Level": Level,
    "ManageAdmins": ManageAdmins,
    "ManageFolios": ManageFolios,
    "ManageStudents": ManageStudents,
    "ManageSubjects": ManageSubjects,
    "Profile": Profile,
    "StudentDetail": StudentDetail,
    "Subject": Subject,
    "UnlockLevel": UnlockLevel,
}

export const pagesConfig = {
    mainPage: "AdminDashboard",
    Pages: PAGES,
    Layout: __Layout,
};
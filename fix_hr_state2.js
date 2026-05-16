const fs = require('fs');

try {
  let hrPage = fs.readFileSync('src/pages/HRPage.js', 'utf8');

  if (!hrPage.includes('AdvancedAttendanceReport')) {
    hrPage = hrPage.replace(
      /import ReportsTab from '\.\/ReportsTab';/,
      `import ReportsTab from './ReportsTab';\nimport AdvancedAttendanceReport from '../components/AdvancedAttendanceReport';`
    );

    hrPage = hrPage.replace(
      /const AttendanceTab = \(\{ allAttendance, allUsers, today, isHR, currentUser, markAttendance \}\) => \{/,
      `const AttendanceTab = ({ allAttendance, allUsers, today, isHR, currentUser, markAttendance, allLeaves, manuallyUpsertAttendanceLog }) => {
  const [viewMode, setViewMode] = useState('daily');`
    );

    hrPage = hrPage.replace(
      /<div style=\{\{ display: 'grid', gridTemplateColumns: 'repeat\(auto-fit, minmax\(300px, 1fr\)\)', gap: 16, marginBottom: 16 \}\}>/,
      `{isHR && (
        <div style={{ marginBottom: 20, display: 'flex', gap: 10 }}>
          <button className={\`btn \${viewMode === 'daily' ? 'btn-primary' : 'btn-outline'}\`} onClick={() => setViewMode('daily')}>📅 Daily Log</button>
          <button className={\`btn \${viewMode === 'advanced' ? 'btn-primary' : 'btn-outline'}\`} onClick={() => setViewMode('advanced')}>📊 Advanced Reports</button>
        </div>
      )}

      {viewMode === 'advanced' ? (
        <AdvancedAttendanceReport 
          allUsers={allUsers.filter(u => u.role !== 'Admin')} 
          allAttendance={allAttendance}
          allLeaves={allLeaves}
          manuallyUpsertAttendanceLog={manuallyUpsertAttendanceLog}
        />
      ) : (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 16, marginBottom: 16 }}>`
    );

    hrPage = hrPage.replace(
      /<\/div>\n      \)\}\n    <\/div>\n  \);\n\};/,
      `</div>
      )}
      </>
      )}
    </div>
  );
};`
    );

    hrPage = hrPage.replace(
      /const HRPage = \(\{ defaultTab \}\) => \{[\s\S]*?const \{ \n    currentUser, allUsers, allAttendance, allLeaves, \n    updateLeave, applyLeave, markAttendance, updateUser, addAuditLog \n  \} = useApp\(\);/,
      `const HRPage = ({ defaultTab }) => {
  const { 
    currentUser, allUsers, allAttendance, allLeaves, 
    updateLeave, applyLeave, markAttendance, manuallyUpsertAttendanceLog, updateUser, addAuditLog 
  } = useApp();`
    );

    hrPage = hrPage.replace(
      /allAttendance=\{allAttendance\}\n          allUsers=\{allUsers\}\n          today=\{today\}\n          isHR=\{isHR\}\n          currentUser=\{currentUser\}\n          markAttendance=\{markAttendance\}\n        \/>/,
      `allAttendance={allAttendance}
          allUsers={allUsers}
          allLeaves={allLeaves}
          today={today}
          isHR={isHR}
          currentUser={currentUser}
          markAttendance={markAttendance}
          manuallyUpsertAttendanceLog={manuallyUpsertAttendanceLog}
        />`
    );
    
    fs.writeFileSync('src/pages/HRPage.js', hrPage);
    console.log('HRPage updated successfully');
  } else {
    console.log('HRPage already updated');
  }

  // Update AppContext.js again in case it was reset
  let appCtx = fs.readFileSync('src/context/AppContext.js', 'utf8');
  if (!appCtx.includes('upsertAttendanceLogDB')) {
    appCtx = appCtx.replace(
      /import \{[\s\S]*?deleteProjectRecord\n\} from '\.\.\/services\/projectsDatabase';/,
      `import {
  initializeProjectsDatabase,
  getAllProjects as getAllProjectsFromDB,
  createProjectRecord,
  updateProjectRecord,
  deleteProjectRecord
} from '../services/projectsDatabase';
import {
  initializeAttendanceDatabase,
  getAllAttendanceLogs,
  upsertAttendanceLog as upsertAttendanceLogDB
} from '../services/attendanceDatabase';`
    );
  }

  if (!appCtx.includes('dbAttendance = getAllAttendanceLogs()')) {
    appCtx = appCtx.replace(
      /setAllProjects\(dbProjects\);\n\n      setIsInitialized\(true\);/,
      `setAllProjects(dbProjects);

      let dbAttendance = getAllAttendanceLogs();
      if (!dbAttendance || dbAttendance.length === 0) {
        initializeAttendanceDatabase(initialAttendance);
        dbAttendance = initialAttendance;
      }
      setAllAttendance(dbAttendance);

      setIsInitialized(true);`
    );
  }

  if (!appCtx.includes('manuallyUpsertAttendanceLog = (logData)')) {
    appCtx = appCtx.replace(
      /return prev\.map\(\(a\) => \(a\.userId === userId && a\.date === today \? updated : a\)\);\n    \}\);\n  \};\n\n  \/\/ ─── Leave/,
      `return prev.map((a) => (a.userId === userId && a.date === today ? updated : a));
    });
    
    setTimeout(() => {
      setAllAttendance(current => {
        initializeAttendanceDatabase(current);
        return current;
      });
    }, 100);
  };

  const manuallyUpsertAttendanceLog = (logData) => {
    const updatedLog = upsertAttendanceLogDB(logData);
    setAllAttendance((prev) => {
      const exists = prev.find(a => a.userId === logData.userId && a.date === logData.date);
      if (exists) {
        return prev.map(a => (a.userId === logData.userId && a.date === logData.date ? updatedLog : a));
      }
      return [...prev, updatedLog];
    });
  };

  // ─── Leave`
    );
  }

  if (!appCtx.includes('markAttendance, manuallyUpsertAttendanceLog')) {
    appCtx = appCtx.replace(
      /allAttendance, markAttendance,/,
      `allAttendance, markAttendance, manuallyUpsertAttendanceLog,`
    );
  }
  
  fs.writeFileSync('src/context/AppContext.js', appCtx);
  console.log('AppContext updated successfully');

} catch(e) {
  console.error(e);
}

export class ShiftScheduler {
  constructor() {
    this.employees = [];
    this.preferences = [];
    this.schedule = {};
    this.maxDayShifts = 22;
    this.maxNightShifts = 22;
    this.days = Array.from({length: 31}, (_, i) => i + 1);
    this.initSchedule();
  }

  initSchedule() {
    this.days.forEach(day => {
      this.schedule[day] = {
        day: Array(this.maxDayShifts).fill(null),
        night: Array(this.maxNightShifts).fill(null)
      };
    });
  }

  init() {
    this.loadFromLocalStorage();
    this.setupEventListeners();
    this.openTab('schedule');
    this.updateAllDisplays();
  }

  setupEventListeners() {
    document.querySelectorAll('.tab-button').forEach(button => {
      button.addEventListener('click', () => this.openTab(button.dataset.tab));
    });

    document.getElementById('addEmployee').addEventListener('click', () => this.addOrUpdateEmployee());
    document.getElementById('addPreference').addEventListener('click', () => this.addPreference());
    document.getElementById('saveLimits').addEventListener('click', () => this.updateShiftLimits());
    document.getElementById('generateSchedule').addEventListener('click', () => this.generateSchedule());

    document.getElementById('scheduleTable').addEventListener('click', (e) => {
      if (e.target.classList.contains('schedule-item')) {
        this.handleScheduleItemClick(e.target);
      }
    });
  }

  openTab(tabName) {
    document.querySelectorAll('.tab-content').forEach(tab => tab.classList.remove('active'));
    document.querySelectorAll('.tab-button').forEach(button => button.classList.remove('active'));
    document.getElementById(tabName).classList.add('active');
    document.querySelector(`.tab-button[data-tab="${tabName}"]`).classList.add('active');
    
    if (tabName === 'schedule') this.updateSchedule();
    if (tabName === 'employees') this.updateEmployeeList();
    if (tabName === 'preferences') this.updatePreferencesUI();
    if (tabName === 'scouts') this.updateScoutList();
    if (tabName === 'admin') this.updateAdminDisplay();
  }

  addOrUpdateEmployee() {
    const name = document.getElementById('employeeName').value.trim();
    const scoutData = document.getElementById('scoutData').value.trim();
    const shift = document.getElementById('shiftType').value;
    
    if (name) {
      const existingIndex = this.employees.findIndex(e => e.name === name);
      if (existingIndex > -1) {
        this.employees[existingIndex] = { name, scoutData, preferredShift: shift };
      } else {
        this.employees.push({ name, scoutData, preferredShift: shift });
      }
      this.updateAllDisplays();
      this.saveToLocalStorage();
      document.getElementById('employeeName').value = '';
      document.getElementById('scoutData').value = '';
    }
  }

  removeEmployee(name) {
    this.employees = this.employees.filter(e => e.name !== name);
    this.preferences = this.preferences.filter(p => p.employee !== name);
    this.updateAllDisplays();
    this.saveToLocalStorage();
  }

  addPreference() {
    const employee = document.getElementById('prefEmployeeSelect').value;
    const day = parseInt(document.getElementById('prefDay').value);
    const shift = document.getElementById('prefShiftType').value;
    
    if (employee && day >= 1 && day <= 31) {
      const existingIndex = this.preferences.findIndex(p => p.employee === employee && p.day === day);
      if (existingIndex > -1) {
        this.preferences[existingIndex].shift = shift;
      } else {
        this.preferences.push({ employee, day, shift });
      }
      this.updatePreferencesUI();
      this.saveToLocalStorage();
    }
  }

  removePreference(employee, day) {
    this.preferences = this.preferences.filter(p => !(p.employee === employee && p.day === day));
    this.updatePreferencesUI();
    this.saveToLocalStorage();
  }

  updateShiftLimits() {
    this.maxDayShifts = parseInt(document.getElementById('maxDayShifts').value) || 22;
    this.maxNightShifts = parseInt(document.getElementById('maxNightShifts').value) || 22;
    this.initSchedule();
    this.updateSchedule();
    this.saveToLocalStorage();
  }

  generateSchedule() {
    this.initSchedule();
    
    this.employees.forEach(employee => {
      const employeePrefs = this.preferences.filter(p => p.employee === employee.name);
      
      employeePrefs.forEach(pref => {
        if (pref.shift === 'off') return;
        
        const shiftArray = this.schedule[pref.day][pref.shift];
        const emptyIndex = shiftArray.findIndex(slot => slot === null);
        if (emptyIndex !== -1) {
          shiftArray[emptyIndex] = employee.name;
        }
      });
    });

    this.distributeRemainingShifts();
    this.updateSchedule();
    this.saveToLocalStorage();
  }

  distributeRemainingShifts() {
    const employeesWithShifts = {};
    this.employees.forEach(emp => {
      employeesWithShifts[emp.name] = { day: 0, night: 0 };
    });

    this.days.forEach(day => {
      ['day', 'night'].forEach(shiftType => {
        this.schedule[day][shiftType].forEach(employee => {
          if (employee) employeesWithShifts[employee][shiftType]++;
        });
      });
    });

    this.days.forEach(day => {
      ['day', 'night'].forEach(shiftType => {
        const shiftArray = this.schedule[day][shiftType];
        const maxShifts = shiftType === 'day' ? this.maxDayShifts : this.maxNightShifts;
        
        for (let i = 0; i < maxShifts; i++) {
          if (shiftArray[i] === null) {
            const availableEmployees = this.getAvailableEmployees(day, shiftType, employeesWithShifts);
            if (availableEmployees.length > 0) {
              const selectedEmployee = this.selectEmployeeForShift(availableEmployees, shiftType, employeesWithShifts);
              shiftArray[i] = selectedEmployee;
              employeesWithShifts[selectedEmployee][shiftType]++;
            }
          }
        }
      });
    });
  }

  getAvailableEmployees(day, shiftType, employeesWithShifts) {
    return this.employees.filter(emp => {
      const pref = this.preferences.find(p => p.employee === emp.name && p.day === day);
      if (pref && pref.shift !== shiftType && pref.shift !== 'any') return false;
      
      const maxShifts = shiftType === 'day' ? this.maxDayShifts : this.maxNightShifts;
      const currentShifts = employeesWithShifts[emp.name][shiftType];
      
      return currentShifts < maxShifts && 
             (emp.preferredShift === 'any' || emp.preferredShift === shiftType);
    }).map(emp => emp.name);
  }

  selectEmployeeForShift(availableEmployees, shiftType, employeesWithShifts) {
    return availableEmployees.reduce((prev, curr) => {
      return employeesWithShifts[prev][shiftType] < employeesWithShifts[curr][shiftType] ? prev : curr;
    });
  }

  handleScheduleItemClick(item) {
    const day = parseInt(item.closest('.day-column').querySelector('h4').textContent.split(' ')[1]);
    const shiftType = item.closest('.day, .night').classList.contains('day') ? 'day' : 'night';
    const shiftIndex = Array.from(item.parentNode.children).indexOf(item) - 1;
    
    const currentEmployee = this.schedule[day][shiftType][shiftIndex];
    const availableEmployees = ['-'].concat(this.employees.map(e => e.name));
    
    const select = document.createElement('select');
    availableEmployees.forEach(emp => {
      const option = document.createElement('option');
      option.value = emp;
      option.textContent = emp === '-' ? 'Пусто' : emp;
      option.selected = emp === currentEmployee;
      select.appendChild(option);
    });
    
    select.addEventListener('change', () => {
      this.schedule[day][shiftType][shiftIndex] = select.value === '-' ? null : select.value;
      this.updateSchedule();
      this.saveToLocalStorage();
    });
    
    item.innerHTML = '';
    item.appendChild(select);
    select.focus();
  }

  updateAllDisplays() {
    this.updateEmployeeList();
    this.updateSchedule();
    this.updateScoutList();
    this.updatePreferencesUI();
    this.updateAdminDisplay();
  }

  updateEmployeeList() {
    const employeeList = document.getElementById('employeeList');
    employeeList.innerHTML = '';
    this.employees.forEach(e => {
      const li = document.createElement('li');
      li.innerHTML = `${e.name} (Скаут: ${e.scoutData || 'Нет данных'}) - ${e.preferredShift} 
        <button onclick="scheduler.removeEmployee('${e.name}')">Удалить</button>`;
      employeeList.appendChild(li);
    });
  }

  updateSchedule() {
    const scheduleTable = document.getElementById('scheduleTable');
    scheduleTable.innerHTML = '';

    this.days.forEach(day => {
      const dayColumn = document.createElement('div');
      dayColumn.className = 'day-column';

      ['day', 'night'].forEach(shiftType => {
        const section = document.createElement('div');
        section.className = shiftType;
        const header = document.createElement('h4');
        header.textContent = `${shiftType === 'day' ? 'День' : 'Ночь'} ${day}`;
        section.appendChild(header);
        
        const maxShifts = shiftType === 'day' ? this.maxDayShifts : this.maxNightShifts;
        for (let i = 0; i < maxShifts; i++) {
          const item = document.createElement('div');
          item.className = 'schedule-item ' + (!this.schedule[day][shiftType][i] ? 'empty' : '');
          item.textContent = this.schedule[day][shiftType][i] || '-';
          section.appendChild(item);
        }
        
        dayColumn.appendChild(section);
      });

      scheduleTable.appendChild(dayColumn);
    });
  }

  updatePreferencesUI() {
    const prefEmployeeSelect = document.getElementById('prefEmployeeSelect');
    prefEmployeeSelect.innerHTML = '';
    this.employees.forEach(emp => {
      const option = document.createElement('option');
      option.value = emp.name;
      option.textContent = emp.name;
      prefEmployeeSelect.appendChild(option);
    });

    const preferencesList = document.getElementById('preferencesList');
    preferencesList.innerHTML = '';
    this.preferences.forEach(p => {
      const li = document.createElement('li');
      li.innerHTML = `${p.employee} - День ${p.day} (${p.shift === 'day' ? 'День' : p.shift === 'night' ? 'Ночь' : 'Выходной'}) 
        <button onclick="scheduler.removePreference('${p.employee}', ${p.day})">Удалить</button>`;
      preferencesList.appendChild(li);
    });
  }

  updateScoutList() {
    const scoutList = document.getElementById('scoutList');
    scoutList.innerHTML = '';
    const uniqueScouts = [...new Set(this.employees.map(e => e.scoutData).filter(data => data))];
    uniqueScouts.forEach(data => {
      const li = document.createElement('li');
      li.textContent = data;
      scoutList.appendChild(li);
    });
  }

  updateAdminDisplay() {
    document.getElementById('maxDayShifts').value = this.maxDayShifts;
    document.getElementById('maxNightShifts').value = this.maxNightShifts;
  }

  saveToLocalStorage() {
    localStorage.setItem('shiftSchedulerData', JSON.stringify({
      employees: this.employees,
      preferences: this.preferences,
      schedule: this.schedule,
      maxDayShifts: this.maxDayShifts,
      maxNightShifts: this.maxNightShifts
    }));
  }

  loadFromLocalStorage() {
    const data = JSON.parse(localStorage.getItem('shiftSchedulerData'));
    if (data) {
      this.employees = data.employees || [];
      this.preferences = data.preferences || [];
      this.schedule = data.schedule || {};
      this.maxDayShifts = data.maxDayShifts || 22;
      this.maxNightShifts = data.maxNightShifts || 22;
    }
  }
}

window.scheduler = new ShiftScheduler();
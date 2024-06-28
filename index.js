// Set the input of endtime to now
const now = new Date();
const nowHour = now.getHours();
const nowMinute = now.getMinutes();
const nowString = `${nowHour < 10 ? "0" : ""}${nowHour}:${nowMinute < 10 ? "0" : ""}${nowMinute}`;
document.getElementById("endTime").value = nowString;

function calculateWorkHours() {
    const startTime = document.getElementById("startTime").value;
    const endTime = document.getElementById("endTime").value;
    const calculateBtn = document.getElementById("calculate-btn");

    const start = new Date(`01/01/2020 ${startTime}`);
    const end = new Date(`01/01/2020 ${endTime}`);
    
    if (endTime === "00:00") {
        end.setDate(end.getDate() + 1);
    }
    console.log(`Start time: ${start}, End time: ${end}`);

    // Validate times (6:00 AM to 12:00 AM)
    if (start >= end || !(start >= new Date("01/01/2020 06:00") && start <= new Date("01/01/2020 23:59")) || !(end >= new Date("01/01/2020 06:01") && end <= new Date("01/02/2020 0:00"))) {
        console.log(`Invalid time range: ${start} to ${end}`);
        calculateBtn.disabled = true;
        return;
    }

    calculateBtn.disabled = false;

    start.setMinutes(start.getMinutes() + 1);
    end.setMinutes(end.getMinutes() - 1);

    // Convert hours to a continuous minute scale from 6:00 AM to midnight
    let current = new Date(start);
    

    // Track work during meal times
    let mealTimeWork11to1 = 0;  // Work minutes between 11 AM and 1 PM
    let mealTimeWork6to8 = 0;   // Work minutes between 6 PM and 8 PM
    let totalMinutes = 0;
    let breakMinutes = 0;
    let overMinutes = 0;

    while (current < end) {
        let hour = current.getHours();
        let isWorkTime = true;
        totalMinutes++;

        // Check for meal times
        if ((hour === 11 || hour === 12)) {
            if (mealTimeWork11to1 <60) {
                mealTimeWork11to1++;
            } else {
                breakMinutes++;
            }
        } else if ((hour === 18 || hour === 19)) {
            if (mealTimeWork6to8 < 60) {
                mealTimeWork6to8++;
            } else {
                breakMinutes++;
            }
        } else {
            isWorkTime = (hour < 11 || (hour >= 13 && hour < 18) || hour >= 20);
            if (!isWorkTime) {
                breakMinutes++;
            }
        }

        // Increment by 1 minute
        current.setMinutes(current.getMinutes() + 1);
    }

    if (breakMinutes < 30){
        breakMinutes = 30;
    }
    breakMinutes = Math.min(breakMinutes, totalMinutes);
    
    workMinutes = totalMinutes - breakMinutes;

    if (workMinutes > 12*60){
        overMinutes = workMinutes - 12*60;
        workMinutes = 12*60;
    }

    document.getElementById("calculateHint").textContent = "";

    console.log(`Total minutes: ${totalMinutes}`);
    // Update the UI
    document.getElementById("totalOnHours").textContent = `${Math.floor((totalMinutes / 60))} 시간 ${((totalMinutes % 60))} 분`;
    document.getElementById("workHours").textContent = `${Math.floor((workMinutes / 60))} 시간 ${((workMinutes % 60))} 분`;

    // Enable the "Add Shift to Table" button
    document.getElementById("addShiftButton").disabled = false;
}

function saveToLocalStorage() {
    const shifts = [];
    const tableBody = document.getElementById("shiftTableBody");
    for (let row of tableBody.rows) {
        shifts.push({
            startTime: row.cells[0].textContent,
            endTime: row.cells[1].textContent,
            workHours: row.cells[2].textContent
        });
    }
    localStorage.setItem('shifts', JSON.stringify(shifts));
}

function loadFromLocalStorage() {
    const shifts = JSON.parse(localStorage.getItem('shifts')) || [];
    const tableBody = document.getElementById("shiftTableBody");
    shifts.forEach(shift => {
        const newRow = tableBody.insertRow();
        newRow.insertCell().textContent = shift.startTime;
        newRow.insertCell().textContent = shift.endTime;
        newRow.insertCell().textContent = shift.workHours;

        const actionCell = newRow.insertCell();
        const removeButton = document.createElement("button");
        removeButton.textContent = "행 제거";
        removeButton.className = "remove-btn";
        removeButton.onclick = function() {
            tableBody.removeChild(newRow);
            calculateTotalHours();
            saveToLocalStorage();
        };
        actionCell.appendChild(removeButton);
    });
    calculateTotalHours();
}

// Modify addShiftToTable function to save to localStorage
function addShiftToTable() {
    const startTime = document.getElementById("startTime").value;
    const endTime = document.getElementById("endTime").value;
    const workHours = document.getElementById("workHours").textContent;

    const tableBody = document.getElementById("shiftTableBody");
    const newRow = tableBody.insertRow();

    newRow.insertCell().textContent = startTime;
    newRow.insertCell().textContent = endTime;
    newRow.insertCell().textContent = workHours;

    const actionCell = newRow.insertCell();
    const removeButton = document.createElement("button");
    removeButton.textContent = "Remove";
    removeButton.className = "remove-btn";
    removeButton.onclick = function() {
        tableBody.removeChild(newRow);
        calculateTotalHours();
    };
    actionCell.appendChild(removeButton);

    calculateTotalHours();
    saveToLocalStorage();

    // Disable the "Add Shift to Table" button after adding a shift
    document.getElementById("addShiftButton").disabled = true;
}

// Modify resetTable function to clear localStorage
function resetTable() {
    const tableBody = document.getElementById("shiftTableBody");
    tableBody.innerHTML = "";
    calculateTotalHours();
    localStorage.removeItem('shifts');
}

// Load saved shifts when the page loads
window.onload = loadFromLocalStorage;

document.getElementById("timeForm").addEventListener("input", function() {
    const startTime = document.getElementById("startTime").value;
    const endTime = document.getElementById("endTime").value;
    const calculateBtn = document.getElementById("calculate-btn");

    if (startTime && endTime) {
        const start = new Date(`01/01/2020 ${startTime}`);
        const end = new Date(`01/01/2020 ${endTime}`);
        if (endTime === "00:00") {
            end.setDate(end.getDate() + 1);
        }

        calculateBtn.disabled = start >= end || 
                                !(start >= new Date("01/01/2020 06:00") && start <= new Date("01/01/2020 23:59")) || 
                                !(end >= new Date("01/01/2020 06:01") && end <= new Date("01/02/2020 0:00"));
    } else {
        calculateBtn.disabled = true;
    }
});


function calculateTotalHours() {
    const tableBody = document.getElementById("shiftTableBody");
    let totalWork = 0;

    for (let row of tableBody.rows) {
        totalWork += parseHoursToMinutes(row.cells[2].textContent);
    }

    document.getElementById("totalWorkHours").textContent = formatMinutesToHours(totalWork);
}

function parseHoursToMinutes(timeString) {
    const [hours, minutes] = timeString.split('시간 ');
    return parseInt(hours) * 60 + parseInt(minutes);
}

function formatMinutesToHours(minutes) {
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    return `${hours}시간 ${remainingMinutes}분`;
}

function checkTimeinput() {
    const startTime = document.getElementById("startTime").value;
    const endTime = document.getElementById("endTime").value;
    const calculateBtn = document.getElementById("calculate-btn");
    const calculateHint = document.getElementById("calculateHint");

    console.log(`Start time: ${startTime}, End time: ${endTime}`);
    if (startTime && endTime) {
        const start = new Date(`01/01/2020 ${startTime}`);
        const end = new Date(`01/01/2020 ${endTime}`);
        if (endTime === "00:00") {
            end.setDate(end.getDate() + 1);
        }

        const isInvalidRange = start >= end || 
                               !(start >= new Date("01/01/2020 06:00") && start <= new Date("01/01/2020 23:59")) || 
                               !(end >= new Date("01/01/2020 06:01") && end <= new Date("01/02/2020 0:00"));

        calculateBtn.disabled = isInvalidRange;


        if (isInvalidRange) {
            calculateHint.textContent = "유효하지 않은 시간 범위입니다. 출근 시간은 06:00에서 23:59 사이, 퇴근 시간은 06:01에서 24:00 사이여야 합니다.";
        } else {
            calculateHint.textContent = "";
        }
    } else {
        calculateBtn.disabled = true;
        calculateHint.textContent = "출근 시간과 퇴근 시간을 모두 입력해주세요.";
    }
};

document.onload = checkTimeinput();

document.getElementById("timeForm").addEventListener("input", checkTimeinput );
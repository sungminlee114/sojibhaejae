let uploadedFiles = [];
let processedData = [];
let allDatesInFiles = new Set(); // 파일에 있는 모든 날짜
let availableYearMonths = new Set(); // 사용 가능한 년/월
let selectedYearMonth = null; // 선택된 년/월
let fileMetadata = new Map(); // 파일별 메타데이터 (날짜별 최신 파일 추적)
let currentCalendarStartIndex = 0; // 현재 캘린더 시작 인덱스 (0부터 시작)
const MONTHS_PER_PAGE = 2; // 한 페이지에 표시할 월 수

// 드래그 앤 드롭 설정
const dropZone = document.getElementById('dropZone');
const fileInput = document.getElementById('excelFiles');

dropZone.addEventListener('click', (e) => {
    // 파일 인풋 자체를 클릭한 경우 중복 방지
    if (e.target !== fileInput) {
        fileInput.click();
    }
});

dropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropZone.classList.add('drag-over');
});

dropZone.addEventListener('dragleave', () => {
    dropZone.classList.remove('drag-over');
});

dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZone.classList.remove('drag-over');

    const files = Array.from(e.dataTransfer.files).filter(file =>
        file.name.endsWith('.xlsx') || file.name.endsWith('.xls')
    );

    if (files.length > 0) {
        // FileList를 DataTransfer를 통해 input에 할당
        const dt = new DataTransfer();
        files.forEach(file => dt.items.add(file));
        fileInput.files = dt.files;

        handleFileSelection(files);
    }
});

// 파일 선택 시 처리
fileInput.addEventListener('change', function(e) {
    const files = Array.from(e.target.files);
    handleFileSelection(files);
});

// 파일 선택 처리
async function handleFileSelection(files) {
    const statusSpan = document.getElementById('fileStatus');
    statusSpan.textContent = '';
    statusSpan.className = '';

    if (files.length === 0) {
        uploadedFiles = [];
        document.getElementById('fileCount').textContent = 0;
        const calendarContainer = document.getElementById('calendarContainer');
        calendarContainer.innerHTML = '<div class="empty-state"><p>파일을 업로드하면 데이터 범위가 표시됩니다.</p></div>';
        return;
    }

    // 파일 검증 및 분석
    const validFiles = await validateAndAnalyzeFiles(files);

    uploadedFiles = validFiles;
    document.getElementById('fileCount').textContent = validFiles.length;

    if (validFiles.length > 0) {
        // 캘린더 표시
        displayDataRangeCalendar();
    } else {
        statusSpan.textContent = '(유효한 파일이 없습니다)';
        statusSpan.className = 'error';
        const calendarContainer = document.getElementById('calendarContainer');
        calendarContainer.innerHTML = '<div class="empty-state"><p>파일을 업로드하면 데이터 범위가 표시됩니다.</p></div>';
    }
}

// 파일 검증 및 분석
async function validateAndAnalyzeFiles(files) {
    allDatesInFiles.clear();
    availableYearMonths.clear();
    fileMetadata.clear();
    currentCalendarStartIndex = 0; // 인덱스 리셋

    const validFiles = [];
    const statusSpan = document.getElementById('fileStatus');
    let invalidCount = 0;
    let duplicateWarning = false;

    for (const file of files) {
        try {
            const data = await readExcelFile(file);

            // 파일 형식 검증
            if (!isValidWorkbookFormat(data)) {
                console.log(`Invalid format: ${file.name}`);
                invalidCount++;
                continue;
            }

            // 날짜별 파일 메타데이터 추출
            const fileDates = extractFileDates(data);

            if (fileDates.length === 0) {
                console.log(`No valid dates: ${file.name}`);
                invalidCount++;
                continue;
            }

            // 중복 체크 및 최신 파일 선택
            fileDates.forEach(({ dateKey, yearMonth }) => {
                if (fileMetadata.has(dateKey)) {
                    duplicateWarning = true;
                    // 파일명이나 수정 시간으로 최신 파일 판단 (여기서는 나중에 추가된 파일)
                    const existing = fileMetadata.get(dateKey);
                    if (file.lastModified > existing.file.lastModified) {
                        fileMetadata.set(dateKey, { file, yearMonth });
                    }
                } else {
                    fileMetadata.set(dateKey, { file, yearMonth });
                }
            });

            validFiles.push(file);

        } catch (error) {
            console.error(`Error reading file ${file.name}:`, error);
            invalidCount++;
        }
    }

    // 메타데이터에서 최종 날짜 정보 추출
    fileMetadata.forEach((metadata, dateKey) => {
        allDatesInFiles.add(dateKey);
        availableYearMonths.add(metadata.yearMonth);
    });

    // 상태 메시지 표시
    if (invalidCount > 0) {
        statusSpan.textContent = `(${invalidCount}개 파일 무시됨)`;
        statusSpan.className = 'warning';
    }

    if (duplicateWarning) {
        const currentStatus = statusSpan.textContent;
        statusSpan.textContent = currentStatus ? `${currentStatus} - 중복 날짜 발견, 최신 파일 사용` : '(중복 날짜 발견, 최신 파일 사용)';
        statusSpan.className = 'warning';
    }

    return validFiles;
}

// 워크북 형식 검증
function isValidWorkbookFormat(data) {
    if (!data || data.length < 3) return false;

    const headerRow = data[0];

    // 최소한 날짜 컬럼이 있는지 확인
    if (!headerRow || headerRow.length < 7) return false;

    // 첫 번째 날짜 컬럼 확인 (인덱스 1)
    const firstDate = parseDate(headerRow[1]);
    return firstDate !== null;
}

// 파일에서 날짜 추출
function extractFileDates(data) {
    const dates = [];
    const headerRow = data[0];

    // 각 날짜별로 처리 (6개 컬럼씩)
    for (let i = 1; i < headerRow.length; i += 6) {
        const dateStr = headerRow[i];
        if (!dateStr) continue;

        const date = parseDate(dateStr);
        if (!date) continue;

        const dateKey = formatDate(date);
        const yearMonth = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

        dates.push({ dateKey, yearMonth });
    }

    return dates;
}

// 년/월 선택 처리
function selectYearMonth(year, month) {
    selectedYearMonth = { year, month };

    // 캘린더 다시 그리기 (선택 상태 표시)
    displayDataRangeCalendar();
}

// 선택된 년/월로 데이터 처리
async function processSelectedMonth() {
    if (!selectedYearMonth) {
        alert('년/월을 선택해주세요.');
        return;
    }

    await processFiles(selectedYearMonth.year, selectedYearMonth.month);
}

// 시간 문자열을 분으로 변환
function timeToMinutes(timeStr) {
    if (!timeStr) return 0;

    const hourMatch = timeStr.match(/(\d+)시간/);
    const minMatch = timeStr.match(/(\d+)분/);

    const hours = hourMatch ? parseInt(hourMatch[1]) : 0;
    const minutes = minMatch ? parseInt(minMatch[1]) : 0;

    return hours * 60 + minutes;
}

// 분을 "X시간 Y분" 형식으로 변환
function minutesToTimeStr(totalMinutes) {
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;

    if (hours > 0 && minutes > 0) {
        return `${hours}시간${minutes}분`;
    } else if (hours > 0) {
        return `${hours}시간`;
    } else {
        return `${minutes}분`;
    }
}

// 날짜 파싱 (YYYY-MM-DD 또는 엑셀 날짜 형식)
function parseDate(dateValue) {
    if (!dateValue) return null;

    // 엑셀 시리얼 번호인 경우
    if (typeof dateValue === 'number') {
        const excelEpoch = new Date(1899, 11, 30);
        const date = new Date(excelEpoch.getTime() + dateValue * 86400000);
        return date;
    }

    // 문자열 날짜인 경우
    if (typeof dateValue === 'string') {
        const date = new Date(dateValue);
        if (!isNaN(date.getTime())) {
            return date;
        }
    }

    return null;
}

// 날짜를 YYYY-MM-DD 형식으로 변환
function formatDate(date) {
    if (!date) return '';
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

// 엑셀 파일 처리
async function processFiles(year, month) {
    if (!year || !month) {
        alert('년도와 월을 선택해주세요.');
        return;
    }

    processedData = [];

    try {
        // 해당 월의 모든 날짜 가져오기
        const targetYearMonth = `${year}-${String(month).padStart(2, '0')}`;
        const datesInMonth = Array.from(fileMetadata.entries())
            .filter(([, metadata]) => metadata.yearMonth === targetYearMonth)
            .map(([dateKey]) => dateKey);

        if (datesInMonth.length === 0) {
            alert('선택한 월에 데이터가 없습니다.');
            return;
        }

        // 주 단위로 확장: 해당 월의 날짜들이 속한 주의 모든 날짜 포함
        const extendedDates = getWeekExtendedDates(datesInMonth);

        // 확장된 날짜들을 파일별로 그룹화
        const fileToDateMap = new Map();
        extendedDates.forEach(dateKey => {
            const metadata = fileMetadata.get(dateKey);
            if (metadata) {
                if (!fileToDateMap.has(metadata.file)) {
                    fileToDateMap.set(metadata.file, []);
                }
                fileToDateMap.get(metadata.file).push(dateKey);
            }
        });

        // 각 파일에서 해당 날짜 데이터만 추출
        for (const [file, dates] of fileToDateMap.entries()) {
            const data = await readExcelFile(file);
            const records = parseWeeklyDataForDates(data, dates);
            processedData.push(...records);
        }

        // 날짜순 정렬
        processedData.sort((a, b) => new Date(a.date) - new Date(b.date));

        // 주간 데이터 재계산
        recalculateWeeklyData();

        // 미리보기 표시
        displayPreview();

    } catch (error) {
        alert('파일 처리 중 오류가 발생했습니다: ' + error.message);
        console.error(error);
    }
}

// 주 단위로 날짜 확장 (해당 월의 날짜가 속한 주의 월요일~금요일 모두 포함)
function getWeekExtendedDates(datesInMonth) {
    const extendedSet = new Set();

    datesInMonth.forEach(dateKey => {
        const date = new Date(dateKey);
        const dayOfWeek = date.getDay(); // 0 = 일요일, 1 = 월요일, ...

        // 해당 주의 월요일 찾기
        const monday = new Date(date);
        const daysToMonday = dayOfWeek === 0 ? -6 : -(dayOfWeek - 1);
        monday.setDate(date.getDate() + daysToMonday);

        // 월요일부터 금요일까지 추가
        for (let i = 0; i < 5; i++) {
            const weekDate = new Date(monday);
            weekDate.setDate(monday.getDate() + i);
            const weekDateKey = formatDate(weekDate);

            // 해당 날짜에 데이터가 있으면 추가
            if (fileMetadata.has(weekDateKey)) {
                extendedSet.add(weekDateKey);
            }
        }
    });

    return Array.from(extendedSet);
}

// 엑셀 파일 읽기
function readExcelFile(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();

        reader.onload = function(e) {
            try {
                const data = new Uint8Array(e.target.result);
                const workbook = XLSX.read(data, { type: 'array' });

                // 첫 번째 시트 읽기
                const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
                const jsonData = XLSX.utils.sheet_to_json(firstSheet, { header: 1, raw: false });

                resolve(jsonData);
            } catch (error) {
                reject(error);
            }
        };

        reader.onerror = reject;
        reader.readAsArrayBuffer(file);
    });
}

// 특정 날짜들만 파싱 (중복 방지를 위해)
function parseWeeklyDataForDates(data, targetDates) {
    const records = [];

    if (data.length < 3) return records;

    const headerRow = data[0]; // 날짜 행
    const dataRow = data[2]; // 실제 데이터

    // targetDates를 Set으로 변환 (빠른 검색)
    const dateSet = new Set(targetDates);

    // 각 날짜별로 처리 (6개 컬럼씩)
    for (let i = 1; i < headerRow.length; i += 6) {
        const dateStr = headerRow[i];
        if (!dateStr) continue;

        const date = parseDate(dateStr);
        if (!date) continue;

        const dateKey = formatDate(date);

        // 지정된 날짜만 처리 (년/월 필터링 제거 - 주 단위로 이전/다음 월 포함)
        if (!dateSet.has(dateKey)) continue;

        const status = dataRow[i]; // 근태구분
        const startTime = dataRow[i + 1]; // 출근시간
        const endTime = dataRow[i + 2]; // 퇴근시간
        const breakTime = dataRow[i + 3]; // 휴게시간
        const workTime = dataRow[i + 4]; // 근무시간

        // 모든 날짜를 추가 (데이터가 없어도)
        // 데이터가 없으면 "휴일"로 표시
        const hasData = status || startTime || endTime || workTime;

        records.push({
            date: dateKey,
            status: hasData ? (status || '출근') : '휴일',
            startTime: startTime || '',
            endTime: endTime || '',
            breakTime: breakTime || '',
            workTime: workTime || '',
            weekRange: '', // 나중에 계산
            weekTotal: '', // 나중에 계산
            weekAccum: '' // 나중에 계산
        });
    }

    return records;
}

// 주간 데이터 재계산
function recalculateWeeklyData() {
    let currentWeekStart = null;
    let currentWeekEnd = null;
    let weekRecords = [];
    let weeklyAccum = 0;

    processedData.forEach((record, index) => {
        const recordDate = new Date(record.date);
        const dayOfWeek = recordDate.getDay();

        // 주의 시작 찾기 (일요일 = 0, 월요일 = 1)
        const weekStart = new Date(recordDate);
        weekStart.setDate(recordDate.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));

        // 새로운 주가 시작되면
        if (!currentWeekStart || weekStart.getTime() !== currentWeekStart.getTime()) {
            // 이전 주의 총 근무시간 계산
            if (weekRecords.length > 0) {
                const weekTotal = weekRecords.reduce((sum, r) => sum + timeToMinutes(r.workTime), 0);
                weekRecords.forEach(r => {
                    r.weekTotal = minutesToTimeStr(weekTotal);
                });
            }

            // 새로운 주 시작
            currentWeekStart = new Date(weekStart);
            currentWeekEnd = new Date(weekStart);
            currentWeekEnd.setDate(currentWeekEnd.getDate() + 4); // 금요일
            weekRecords = [];
            weeklyAccum = 0;
        }

        // 주간 범위 설정
        record.weekRange = `${formatDate(currentWeekStart)}~${formatDate(currentWeekEnd)}`;

        // 누적 근무시간 계산
        weeklyAccum += timeToMinutes(record.workTime);
        record.weekAccum = minutesToTimeStr(weeklyAccum);

        weekRecords.push(record);

        // 마지막 레코드 처리
        if (index === processedData.length - 1) {
            const weekTotal = weekRecords.reduce((sum, r) => sum + timeToMinutes(r.workTime), 0);
            weekRecords.forEach(r => {
                r.weekTotal = minutesToTimeStr(weekTotal);
            });
        }
    });
}

// 미리보기 표시
function displayPreview() {
    const previewSection = document.getElementById('previewSection');
    const tableBody = document.getElementById('previewTableBody');
    const recordCount = document.getElementById('recordCount');

    // 테이블 초기화
    tableBody.innerHTML = '';

    // 데이터 표시 with row merging
    let previousWeekRange = null;
    let weekRowSpan = 0;
    let firstWeekRowIndex = -1;

    processedData.forEach((record, index) => {
        const row = document.createElement('tr');

        // 새로운 주가 시작되는지 확인
        if (record.weekRange !== previousWeekRange) {
            // 이전 주의 rowspan 설정
            if (firstWeekRowIndex >= 0 && weekRowSpan > 1) {
                const firstRow = tableBody.children[firstWeekRowIndex];
                const weekRangeCell = firstRow.children[0];
                const weekTotalCell = firstRow.children[1];
                weekRangeCell.setAttribute('rowspan', weekRowSpan);
                weekTotalCell.setAttribute('rowspan', weekRowSpan);
            }

            // 새로운 주 시작
            previousWeekRange = record.weekRange;
            weekRowSpan = 1;
            firstWeekRowIndex = index;

            // 주간 및 주간총근무시간 셀 추가
            row.innerHTML = `
                <td>${record.weekRange}</td>
                <td>${record.weekTotal}</td>
                <td>${record.date}</td>
                <td>${record.status}</td>
                <td>${record.startTime}</td>
                <td>${record.endTime}</td>
                <td>${record.workTime}</td>
                <td>${record.weekAccum}</td>
            `;
        } else {
            // 같은 주 - 주간 및 주간총근무시간 셀 제외
            weekRowSpan++;
            row.innerHTML = `
                <td>${record.date}</td>
                <td>${record.status}</td>
                <td>${record.startTime}</td>
                <td>${record.endTime}</td>
                <td>${record.workTime}</td>
                <td>${record.weekAccum}</td>
            `;
        }

        tableBody.appendChild(row);

        // 마지막 레코드 처리
        if (index === processedData.length - 1 && firstWeekRowIndex >= 0 && weekRowSpan > 1) {
            const firstRow = tableBody.children[firstWeekRowIndex];
            const weekRangeCell = firstRow.children[0];
            const weekTotalCell = firstRow.children[1];
            weekRangeCell.setAttribute('rowspan', weekRowSpan);
            weekTotalCell.setAttribute('rowspan', weekRowSpan);
        }
    });

    recordCount.textContent = processedData.length;
    previewSection.style.display = 'block';
}

// 캘린더 페이지 변경 (1개월씩 슬라이딩)
function changeCalendarPage(direction) {
    const sortedYearMonths = Array.from(availableYearMonths).sort();
    const totalMonths = sortedYearMonths.length;

    currentCalendarStartIndex += direction;

    // 인덱스 범위 제한 (최소 0, 최대 totalMonths - MONTHS_PER_PAGE)
    if (currentCalendarStartIndex < 0) currentCalendarStartIndex = 0;
    if (currentCalendarStartIndex > totalMonths - MONTHS_PER_PAGE) {
        currentCalendarStartIndex = totalMonths - MONTHS_PER_PAGE;
    }

    displayDataRangeCalendar();
}

// 캘린더에 데이터 범위 표시
function displayDataRangeCalendar() {
    const calendarContainer = document.getElementById('calendarContainer');

    if (allDatesInFiles.size === 0) {
        calendarContainer.innerHTML = '<div class="empty-state"><p>파일을 업로드하면 데이터 범위가 표시됩니다.</p></div>';
        return;
    }

    // 날짜를 Date 객체 배열로 변환하고 정렬
    const dates = Array.from(allDatesInFiles)
        .map(d => new Date(d))
        .sort((a, b) => a - b);

    // 년/월별로 그룹화
    const datesByYearMonth = {};
    dates.forEach(date => {
        const yearMonth = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        if (!datesByYearMonth[yearMonth]) {
            datesByYearMonth[yearMonth] = [];
        }
        datesByYearMonth[yearMonth].push(date.getDate());
    });

    const sortedYearMonths = Object.keys(datesByYearMonth).sort();
    const totalMonths = sortedYearMonths.length;

    // 인덱스 범위 확인
    if (currentCalendarStartIndex > totalMonths - MONTHS_PER_PAGE) {
        currentCalendarStartIndex = Math.max(0, totalMonths - MONTHS_PER_PAGE);
    }
    if (currentCalendarStartIndex < 0) {
        currentCalendarStartIndex = 0;
    }

    // 현재 표시할 월 계산
    const endIdx = Math.min(currentCalendarStartIndex + MONTHS_PER_PAGE, totalMonths);
    const visibleYearMonths = sortedYearMonths.slice(currentCalendarStartIndex, endIdx);

    // 캘린더 HTML 생성
    let calendarHTML = '';

    // 페이지네이션 컨트롤 (2개월 초과 시에만 표시)
    if (totalMonths > MONTHS_PER_PAGE) {
        calendarHTML += '<div class="calendar-pagination">';

        // 이전 버튼
        const prevDisabled = currentCalendarStartIndex === 0 ? 'disabled' : '';
        calendarHTML += `<button class="pagination-btn" onclick="changeCalendarPage(-1)" ${prevDisabled}>◀</button>`;

        // 현재 표시 범위 정보
        const displayStart = currentCalendarStartIndex + 1;
        const displayEnd = endIdx;
        calendarHTML += `<span class="pagination-info">${displayStart}-${displayEnd} / ${totalMonths}</span>`;

        // 다음 버튼
        const nextDisabled = currentCalendarStartIndex >= totalMonths - MONTHS_PER_PAGE ? 'disabled' : '';
        calendarHTML += `<button class="pagination-btn" onclick="changeCalendarPage(1)" ${nextDisabled}>▶</button>`;

        calendarHTML += '</div>';
    }

    calendarHTML += '<div class="calendar-grid">';

    // 현재 페이지의 년/월별로 미니 캘린더 생성
    visibleYearMonths.forEach(yearMonth => {
        const [year, month] = yearMonth.split('-').map(Number);
        const isSelected = selectedYearMonth &&
                          selectedYearMonth.year === year &&
                          selectedYearMonth.month === month;
        calendarHTML += generateMiniCalendar(year, month, datesByYearMonth[yearMonth], isSelected);
    });

    calendarHTML += '</div>';
    calendarContainer.innerHTML = calendarHTML;
}

// 미니 캘린더 생성 (월별)
function generateMiniCalendar(year, month, datesWithData, isSelected) {
    const firstDay = new Date(year, month - 1, 1);
    const lastDay = new Date(year, month, 0);
    const daysInMonth = lastDay.getDate();
    const startDayOfWeek = firstDay.getDay();

    const monthNames = ['1월', '2월', '3월', '4월', '5월', '6월', '7월', '8월', '9월', '10월', '11월', '12월'];

    const selectedClass = isSelected ? 'selected' : '';

    let html = `<div class="mini-calendar ${selectedClass}" data-year="${year}" data-month="${month}">
        <div class="mini-calendar-header">
            <span>${year}년 ${monthNames[month - 1]}</span>
            <button class="select-month-btn" onclick="selectYearMonth(${year}, ${month}); processSelectedMonth();">선택</button>
        </div>
        <div class="mini-calendar-weekdays">
            <div>일</div><div>월</div><div>화</div><div>수</div><div>목</div><div>금</div><div>토</div>
        </div>
        <div class="mini-calendar-days">`;

    // 빈 칸 추가 (월 시작 전)
    for (let i = 0; i < startDayOfWeek; i++) {
        html += '<div class="mini-calendar-day empty"></div>';
    }

    // 날짜 추가
    for (let day = 1; day <= daysInMonth; day++) {
        const hasData = datesWithData.includes(day);
        const className = hasData ? 'mini-calendar-day has-data' : 'mini-calendar-day';
        html += `<div class="${className}">${day}</div>`;
    }

    html += '</div></div>';
    return html;
}

// 엑셀 다운로드
function downloadExcel() {
    if (processedData.length === 0) {
        alert('다운로드할 데이터가 없습니다.');
        return;
    }

    // 데이터를 시트 형식으로 변환
    const wsData = [
        ['주간', '주간총근무시간', '날짜', '근태구분', '출근', '퇴근', '근무시간', '주누적근무시간']
    ];

    processedData.forEach(record => {
        wsData.push([
            record.weekRange,
            record.weekTotal,
            record.date,
            record.status,
            record.startTime,
            record.endTime,
            record.workTime,
            record.weekAccum
        ]);
    });

    // 워크시트 생성
    const ws = XLSX.utils.aoa_to_sheet(wsData);

    // 컬럼 너비 설정
    ws['!cols'] = [
        { wch: 25 }, // 주간
        { wch: 15 }, // 주간총근무시간
        { wch: 12 }, // 날짜
        { wch: 10 }, // 근태구분
        { wch: 8 },  // 출근
        { wch: 8 },  // 퇴근
        { wch: 12 }, // 근무시간
        { wch: 15 }  // 주누적근무시간
    ];

    // 워크북 생성
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, '유연근무내역');

    // 파일명 생성
    let filename = '유연근무내역.xlsx';
    if (selectedYearMonth) {
        const { year, month } = selectedYearMonth;
        const monthStr = String(month).padStart(2, '0');
        filename = `유연근무내역_${year}년${monthStr}월.xlsx`;
    }

    // 다운로드
    XLSX.writeFile(wb, filename);
}

// 프린트 함수
function printTable() {
    if (processedData.length === 0) {
        alert('프린트할 데이터가 없습니다.');
        return;
    }

    // 프린트 정보 추가
    const previewSection = document.getElementById('previewSection');
    let printInfo = document.querySelector('.print-info');

    if (!printInfo) {
        printInfo = document.createElement('div');
        printInfo.className = 'print-info';
        previewSection.insertBefore(printInfo, previewSection.firstChild);
    }

    // 프린트 정보 내용
    let infoText = '유연근무 내역';
    if (selectedYearMonth) {
        const { year, month } = selectedYearMonth;
        const monthNames = ['1월', '2월', '3월', '4월', '5월', '6월', '7월', '8월', '9월', '10월', '11월', '12월'];
        infoText = `${year}년 ${monthNames[month - 1]} 유연근무 내역`;
    }
    printInfo.innerHTML = infoText;

    // 프린트 실행
    window.print();
}

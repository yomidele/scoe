
-- 1. Relax course level constraint to allow long programmes (Law/Med/Eng)
ALTER TABLE public.courses DROP CONSTRAINT IF EXISTS courses_level_check;
ALTER TABLE public.courses ADD CONSTRAINT courses_level_check CHECK (level = ANY (ARRAY[100,200,300,400,500,600,700]));

-- 2. Normalize existing Faculty of Education name
UPDATE public.faculties SET name = 'Faculty of Education' WHERE code = 'FED';

-- 3. Insert faculties (idempotent)
INSERT INTO public.faculties (name, code) VALUES
  ('Faculty of Science','SCI'),
  ('Faculty of Engineering','ENG'),
  ('Faculty of Arts','ART'),
  ('Faculty of Social Sciences','SOC'),
  ('Faculty of Management Sciences','MGT'),
  ('Faculty of Law','LAW'),
  ('Faculty of Medicine','MED'),
  ('Faculty of Agriculture','AGR'),
  ('Faculty of Environmental Sciences','ENV')
ON CONFLICT (code) DO NOTHING;

-- 4. Insert departments per faculty
INSERT INTO public.departments (faculty_id, name, code)
SELECT f.id, x.name, x.code FROM public.faculties f JOIN (VALUES
  ('SCI','Computer Science','CSC'),
  ('SCI','Mathematics','MTH'),
  ('SCI','Physics','PHY'),
  ('SCI','Chemistry','CHM'),
  ('SCI','Biology','BIO'),
  ('SCI','Statistics','STA'),
  ('SCI','Biochemistry','BCH'),
  ('SCI','Microbiology','MCB'),
  ('SCI','Geology','GLG'),
  ('ENG','Civil Engineering','CVE'),
  ('ENG','Electrical Engineering','EEE'),
  ('ENG','Mechanical Engineering','MEE'),
  ('ENG','Chemical Engineering','CHE'),
  ('ENG','Computer Engineering','CPE'),
  ('ENG','Agricultural Engineering','AGE'),
  ('ENG','Petroleum Engineering','PTE'),
  ('ART','English Language','ENL'),
  ('ART','History & International Studies','HIS'),
  ('ART','Philosophy','PHL'),
  ('ART','Linguistics','LIN'),
  ('ART','Theatre Arts','THA'),
  ('ART','French','FRN'),
  ('ART','Arabic','ARB'),
  ('ART','Religious Studies','REL'),
  ('SOC','Economics','ECO'),
  ('SOC','Political Science','POL'),
  ('SOC','Sociology','SCY'),
  ('SOC','Psychology','PSY'),
  ('SOC','Mass Communication','MAC'),
  ('SOC','Geography','GEO'),
  ('SOC','Social Work','SWK'),
  ('MGT','Accounting','ACC'),
  ('MGT','Business Administration','BUS'),
  ('MGT','Banking & Finance','BNF'),
  ('MGT','Marketing','MKT'),
  ('MGT','Public Administration','PAD'),
  ('MGT','Entrepreneurship','ENT'),
  ('LAW','Private Law','PVL'),
  ('LAW','Public Law','PBL'),
  ('LAW','International Law','INL'),
  ('LAW','Commercial Law','CML'),
  ('MED','Medicine & Surgery','MDS'),
  ('MED','Nursing Science','NRS'),
  ('MED','Pharmacy','PHA'),
  ('MED','Medical Laboratory Science','MLS'),
  ('MED','Anatomy','ANT'),
  ('MED','Physiology','PSG'),
  ('MED','Public Health','PBH'),
  ('FED','Social Science Education','SSE'),
  ('FED','Education & Computer Science','ECS'),
  ('FED','Education & Mathematics','EMT'),
  ('FED','Education & English','EEN'),
  ('FED','Education & Biology','EBL'),
  ('FED','Education & Chemistry','ECH'),
  ('FED','Education & Physics','EPH'),
  ('FED','Guidance & Counselling','GNC'),
  ('FED','Educational Management','EDM'),
  ('AGR','Crop Science','CPS'),
  ('AGR','Animal Science','ANS'),
  ('AGR','Soil Science','SOS'),
  ('AGR','Agricultural Economics','AEC'),
  ('AGR','Forestry & Wildlife','FWL'),
  ('AGR','Fisheries','FSH'),
  ('ENV','Architecture','ARC'),
  ('ENV','Urban & Regional Planning','URP'),
  ('ENV','Estate Management','EST'),
  ('ENV','Quantity Surveying','QSV'),
  ('ENV','Building Technology','BLD')
) AS x(fac_code, name, code) ON x.fac_code = f.code
ON CONFLICT (faculty_id, code) DO NOTHING;

-- 5. Re-home existing GC matric students into Faculty of Education → Social Science Education
UPDATE public.students
SET faculty_id    = (SELECT id FROM public.faculties WHERE code = 'FED'),
    department_id = (SELECT d.id FROM public.departments d
                     JOIN public.faculties f ON f.id = d.faculty_id
                     WHERE f.code = 'FED' AND d.code = 'SSE')
WHERE matric_number LIKE 'TSU/FED/GC/%';

-- 6. Seed courses. Helper: insert with faculty_id+department_id derived from (fac_code, dept_code).
-- GST courses live under existing "General Studies" / Default Faculty (kept as-is).
WITH gst_dept AS (
  SELECT id AS dept_id, faculty_id FROM public.departments WHERE code = 'GST' LIMIT 1
)
INSERT INTO public.courses (code, title, unit, level, semester, course_type, faculty_id, department_id)
SELECT x.code, x.title, x.unit, x.level, x.semester, 'general', g.faculty_id, g.dept_id
FROM gst_dept g, (VALUES
  ('GST101','Use of English I',2,100,'First'),
  ('GST102','Use of English II',2,100,'Second'),
  ('GST111','Nigerian Peoples and Culture',2,100,'First'),
  ('GST112','Philosophy and Logic',2,100,'Second'),
  ('GST201','Communication in English',2,200,'First'),
  ('GST202','Fundamentals of Peace Studies',2,200,'Second'),
  ('GST211','History and Philosophy of Science',2,200,'First'),
  ('GST212','Introduction to Entrepreneurship',2,200,'Second'),
  ('GST301','Entrepreneurship Development I',2,300,'First'),
  ('GST302','Entrepreneurship Development II',2,300,'Second'),
  ('GST401','Leadership and Governance',2,400,'First'),
  ('GST402','Project Management',2,400,'Second')
) AS x(code, title, unit, level, semester)
ON CONFLICT (code, level, semester) DO NOTHING;

-- 7. Department-specific course seeds
WITH src(fac_code, dept_code, code, title, unit, level, semester) AS (VALUES
  -- Computer Science (CSC under SCI)
  ('SCI','CSC','CSC101','Introduction to Computer Science',3,100,'First'),
  ('SCI','CSC','CSC102','Introduction to Problem Solving',3,100,'Second'),
  ('SCI','CSC','CSC103','Computer Applications',2,100,'First'),
  ('SCI','CSC','CSC201','Computer Programming I',3,200,'First'),
  ('SCI','CSC','CSC202','Computer Programming II',3,200,'Second'),
  ('SCI','CSC','CSC203','Data Structures',3,200,'First'),
  ('SCI','CSC','CSC204','Discrete Mathematics',3,200,'Second'),
  ('SCI','CSC','CSC205','Digital Electronics',3,200,'First'),
  ('SCI','CSC','CSC206','Operating Systems I',3,200,'Second'),
  ('SCI','CSC','CSC301','Algorithms and Complexity',3,300,'First'),
  ('SCI','CSC','CSC302','Database Management Systems',3,300,'Second'),
  ('SCI','CSC','CSC303','Computer Networks',3,300,'First'),
  ('SCI','CSC','CSC304','Software Engineering',3,300,'Second'),
  ('SCI','CSC','CSC305','Artificial Intelligence',3,300,'First'),
  ('SCI','CSC','CSC306','Web Technologies',3,300,'Second'),
  ('SCI','CSC','CSC307','Systems Programming',3,300,'First'),
  ('SCI','CSC','CSC308','Computer Graphics',3,300,'Second'),
  ('SCI','CSC','CSC399','SIWES Industrial Training',6,300,'Second'),
  ('SCI','CSC','CSC401','Compiler Construction',3,400,'First'),
  ('SCI','CSC','CSC402','Information Security',3,400,'Second'),
  ('SCI','CSC','CSC403','Machine Learning',3,400,'First'),
  ('SCI','CSC','CSC404','Mobile Application Development',3,400,'Second'),
  ('SCI','CSC','CSC405','Cloud Computing',3,400,'First'),
  ('SCI','CSC','CSC406','Human Computer Interaction',3,400,'Second'),
  ('SCI','CSC','CSC499','Final Year Project',6,400,'Second'),
  -- Math/Physics/Stats foundational courses (live under MTH dept)
  ('SCI','MTH','MTH101','Elementary Mathematics I',3,100,'First'),
  ('SCI','MTH','MTH102','Elementary Mathematics II',3,100,'Second'),
  ('SCI','MTH','MTH201','Mathematical Methods',3,200,'First'),
  ('SCI','PHY','PHY101','General Physics I',3,100,'First'),
  ('SCI','PHY','PHY102','General Physics II',3,100,'Second'),
  ('SCI','STA','STA101','Introduction to Statistics',3,100,'Second'),
  ('SCI','STA','STA201','Statistics for Computing',3,200,'Second'),
  ('SCI','CHM','CHM101','General Chemistry I',3,100,'First'),
  -- Accounting (ACC under MGT)
  ('MGT','ACC','ACC101','Introduction to Accounting',3,100,'First'),
  ('MGT','ACC','ACC102','Principles of Accounting',3,100,'Second'),
  ('MGT','BUS','BUS101','Introduction to Business',3,100,'First'),
  ('MGT','ACC','ACC201','Financial Accounting I',3,200,'First'),
  ('MGT','ACC','ACC202','Financial Accounting II',3,200,'Second'),
  ('MGT','ACC','ACC203','Cost Accounting',3,200,'First'),
  ('MGT','ACC','ACC204','Business Law',3,200,'Second'),
  ('MGT','ACC','ACC205','Taxation I',3,200,'First'),
  ('MGT','BNF','BNF201','Money and Banking',3,200,'Second'),
  ('MGT','ACC','ACC301','Intermediate Accounting',3,300,'First'),
  ('MGT','ACC','ACC302','Management Accounting',3,300,'Second'),
  ('MGT','ACC','ACC303','Auditing I',3,300,'First'),
  ('MGT','ACC','ACC304','Taxation II',3,300,'Second'),
  ('MGT','ACC','ACC305','Public Sector Accounting',3,300,'First'),
  ('MGT','ACC','ACC399','SIWES Industrial Training',6,300,'Second'),
  ('MGT','ACC','ACC401','Advanced Financial Accounting',3,400,'First'),
  ('MGT','ACC','ACC402','Advanced Auditing',3,400,'Second'),
  ('MGT','ACC','ACC403','Corporate Governance',3,400,'First'),
  ('MGT','ACC','ACC404','Financial Management',3,400,'Second'),
  ('MGT','ACC','ACC499','Final Year Project',6,400,'Second'),
  -- Law (split across LAW depts; assign all to Public Law as canonical home)
  ('LAW','PBL','LAW101','Nigerian Legal System',3,100,'First'),
  ('LAW','PBL','LAW102','Legal Methods',3,100,'Second'),
  ('LAW','PBL','LAW103','Introduction to Law',3,100,'First'),
  ('LAW','PBL','LAW201','Constitutional Law I',4,200,'First'),
  ('LAW','PBL','LAW202','Constitutional Law II',4,200,'Second'),
  ('LAW','PVL','LAW203','Law of Contract I',3,200,'First'),
  ('LAW','PVL','LAW204','Law of Contract II',3,200,'Second'),
  ('LAW','PVL','LAW205','Law of Tort I',3,200,'First'),
  ('LAW','PBL','LAW301','Criminal Law',4,300,'First'),
  ('LAW','PVL','LAW302','Land Law',4,300,'Second'),
  ('LAW','PVL','LAW303','Equity and Trust',3,300,'First'),
  ('LAW','CML','LAW304','Company Law',3,300,'Second'),
  ('LAW','PBL','LAW305','Law of Evidence',3,300,'First'),
  ('LAW','INL','LAW401','International Law',3,400,'First'),
  ('LAW','CML','LAW402','Commercial Law',3,400,'Second'),
  ('LAW','PBL','LAW403','Human Rights Law',3,400,'First'),
  ('LAW','PVL','LAW404','Family Law',3,400,'Second'),
  ('LAW','PBL','LAW499','Law Project',6,500,'Second'),
  ('LAW','PBL','LAW501','Clinical Legal Education',4,500,'First'),
  ('LAW','PBL','LAW502','Professional Ethics',3,500,'Second'),
  -- Medicine (MDS under MED)
  ('MED','MDS','MDS101','Introduction to Medicine',3,100,'First'),
  ('MED','ANT','ANA101','Anatomy I',4,100,'First'),
  ('MED','ANT','ANA102','Anatomy II',4,100,'Second'),
  ('MED','MDS','BCH101','Medical Biochemistry I',3,100,'First'),
  ('MED','MDS','BCH102','Medical Biochemistry II',3,100,'Second'),
  ('MED','PSG','PSG201','Physiology I',4,200,'First'),
  ('MED','PSG','PSG202','Physiology II',4,200,'Second'),
  ('MED','MDS','MCB201','Medical Microbiology',3,200,'First'),
  ('MED','MDS','PTH301','Pathology',4,300,'First'),
  ('MED','PHA','PHA301','Pharmacology I',4,300,'Second'),
  ('MED','MDS','MDS401','Internal Medicine',6,400,'First'),
  ('MED','MDS','MDS402','Surgery I',6,400,'Second'),
  ('MED','MDS','MDS501','Paediatrics',5,500,'First'),
  ('MED','MDS','MDS502','Obstetrics & Gynaecology',5,500,'Second'),
  ('MED','MDS','MDS601','Community Medicine',4,600,'First'),
  ('MED','MDS','MDS699','Final MBBS Project',6,600,'Second'),
  -- Civil Engineering (CVE under ENG)
  ('ENG','CVE','CVE101','Engineering Drawing',3,100,'First'),
  ('ENG','CVE','CVE102','Workshop Practice',2,100,'Second'),
  ('ENG','CVE','CVE201','Mechanics of Materials',3,200,'First'),
  ('ENG','CVE','CVE202','Fluid Mechanics I',3,200,'Second'),
  ('ENG','CVE','CVE203','Engineering Surveying',3,200,'First'),
  ('ENG','CVE','CVE204','Structural Analysis I',3,200,'Second'),
  ('ENG','CVE','CVE301','Concrete Technology',3,300,'First'),
  ('ENG','CVE','CVE302','Soil Mechanics',3,300,'Second'),
  ('ENG','CVE','CVE303','Highway Engineering',3,300,'First'),
  ('ENG','CVE','CVE304','Water Resources Engineering',3,300,'Second'),
  ('ENG','CVE','CVE399','SIWES Industrial Training',6,300,'Second'),
  ('ENG','CVE','CVE401','Foundation Engineering',3,400,'First'),
  ('ENG','CVE','CVE402','Structural Design',3,400,'Second'),
  ('ENG','CVE','CVE403','Environmental Engineering',3,400,'First'),
  ('ENG','CVE','CVE404','Construction Management',3,400,'Second'),
  ('ENG','CVE','CVE499','Final Year Project',6,400,'Second'),
  ('ENG','CVE','CVE501','Advanced Structural Analysis',3,500,'First'),
  ('ENG','CVE','CVE599','Engineering Project',6,500,'Second'),
  -- Economics (ECO under SOC)
  ('SOC','ECO','ECO101','Principles of Economics I',3,100,'First'),
  ('SOC','ECO','ECO102','Principles of Economics II',3,100,'Second'),
  ('SOC','ECO','ECO201','Microeconomics I',3,200,'First'),
  ('SOC','ECO','ECO202','Macroeconomics I',3,200,'Second'),
  ('SOC','ECO','ECO203','Mathematics for Economists',3,200,'First'),
  ('SOC','ECO','ECO204','Statistics for Economists',3,200,'Second'),
  ('SOC','ECO','ECO205','Nigerian Economic History',3,200,'First'),
  ('SOC','ECO','ECO301','Microeconomics II',3,300,'First'),
  ('SOC','ECO','ECO302','Macroeconomics II',3,300,'Second'),
  ('SOC','ECO','ECO303','Econometrics I',3,300,'First'),
  ('SOC','ECO','ECO304','Development Economics',3,300,'Second'),
  ('SOC','ECO','ECO305','Public Finance',3,300,'First'),
  ('SOC','ECO','ECO401','Econometrics II',3,400,'First'),
  ('SOC','ECO','ECO402','International Economics',3,400,'Second'),
  ('SOC','ECO','ECO403','Labour Economics',3,400,'First'),
  ('SOC','ECO','ECO404','Monetary Economics',3,400,'Second'),
  ('SOC','ECO','ECO499','Research Project',6,400,'Second'),
  -- Mass Communication (MAC under SOC)
  ('SOC','MAC','MAC101','Introduction to Mass Communication',3,100,'First'),
  ('SOC','MAC','MAC102','History of Communication',3,100,'Second'),
  ('SOC','MAC','MAC201','News Writing and Reporting',3,200,'First'),
  ('SOC','MAC','MAC202','Broadcast Journalism',3,200,'Second'),
  ('SOC','MAC','MAC203','Media Law and Ethics',3,200,'First'),
  ('SOC','MAC','MAC204','Advertising',3,200,'Second'),
  ('SOC','MAC','MAC301','Public Relations',3,300,'First'),
  ('SOC','MAC','MAC302','Feature Writing',3,300,'Second'),
  ('SOC','MAC','MAC303','Media Research Methods',3,300,'First'),
  ('SOC','MAC','MAC304','Photojournalism',3,300,'Second'),
  ('SOC','MAC','MAC399','Media Internship',6,300,'Second'),
  ('SOC','MAC','MAC401','Online Journalism',3,400,'First'),
  ('SOC','MAC','MAC402','Communication Theory',3,400,'Second'),
  ('SOC','MAC','MAC403','Magazine Production',3,400,'First'),
  ('SOC','MAC','MAC499','Research Project',6,400,'Second')
)
INSERT INTO public.courses (code, title, unit, level, semester, course_type, faculty_id, department_id)
SELECT s.code, s.title, s.unit, s.level, s.semester, 'core', f.id, d.id
FROM src s
JOIN public.faculties   f ON f.code = s.fac_code
JOIN public.departments d ON d.faculty_id = f.id AND d.code = s.dept_code
ON CONFLICT (code, level, semester) DO NOTHING;

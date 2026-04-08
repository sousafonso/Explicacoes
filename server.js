const express = require('express');
const path = require('path');
const fs = require('fs');
const session = require('express-session');
const methodOverride = require('method-override');
const multer = require('multer');
const crypto = require('crypto');
const dotenv = require('dotenv');

const { requireAdmin, redirectIfAuthenticated } = require('./middleware/auth');

dotenv.config();

const app = express();
const isProduction = process.env.NODE_ENV === 'production';
const PORT = Number(process.env.PORT) || 3000;
const HOST = process.env.HOST || '0.0.0.0';

const DATA_DIR = path.join(__dirname, 'data');
const DATA_FILE = path.join(DATA_DIR, 'exercises.json');
const UPLOAD_DIR = path.join(__dirname, 'public', 'uploads');

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });
if (!fs.existsSync(DATA_FILE)) fs.writeFileSync(DATA_FILE, '[]', 'utf8');

const storage = multer.diskStorage({
	destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
	filename: (_req, file, cb) => {
		const ext = path.extname(file.originalname).toLowerCase();
		const safeBase =
			path
				.basename(file.originalname, ext)
				.toLowerCase()
				.replace(/[^a-z0-9]+/g, '-')
				.replace(/(^-|-$)/g, '')
				.slice(0, 60) || 'ficheiro';

		cb(null, `${Date.now()}-${crypto.randomUUID()}-${safeBase}${ext}`);
	},
});

const upload = multer({
	storage,
	limits: { fileSize: 10 * 1024 * 1024 },
	fileFilter: (_req, file, cb) => {
		const allowedMime = ['application/pdf', 'image/png', 'image/jpeg', 'image/webp'];
		const allowedExt = ['.pdf', '.png', '.jpg', '.jpeg', '.webp'];
		const ext = path.extname(file.originalname).toLowerCase();

		if (allowedMime.includes(file.mimetype) && allowedExt.includes(ext)) {
			return cb(null, true);
		}

		cb(new Error('Formato inválido. Só são permitidos PDF, PNG, JPG, JPEG e WEBP.'));
	},
});

if (isProduction) {
	// Required on Render so express-session can trust x-forwarded-* headers.
	app.set('trust proxy', 1);
}

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(methodOverride('_method'));
app.use(express.static(path.join(__dirname, 'public')));

app.use(
	session({
		secret: process.env.ADMIN_SESSION_SECRET || 'troca-este-segredo-em-producao',
		resave: false,
		saveUninitialized: false,
		cookie: {
			httpOnly: true,
			sameSite: 'lax',
			secure: isProduction,
			maxAge: 1000 * 60 * 60 * 8,
		},
	})
);

app.use((req, res, next) => {
	res.locals.currentPath = req.path;
	res.locals.isAdmin = Boolean(req.session?.isAdmin);
	res.locals.flash = req.session.flash || null;
	delete req.session.flash;
	next();
});

const readExercises = () => {
	try {
		return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
	} catch {
		return [];
	}
};

const writeExercises = (items) => {
	fs.writeFileSync(DATA_FILE, JSON.stringify(items, null, 2), 'utf8');
};

const normalizeCourse = (course) => (['10', '11', '12'].includes(course) ? course : '10');

const topics = {
	'10': ['Álgebra', 'Geometria', 'Funções', 'Estatística'],
	'11': ['Trigonometria', 'Limites', 'Geometria Analítica', 'Probabilidades'],
	'12': ['Derivadas', 'Integrais', 'Funções Exponenciais', 'Preparação para Exame'],
};

const groupExercises = (items) => {
	const grouped = { '10': {}, '11': {}, '12': {} };

	for (const ex of items) {
		if (!grouped[ex.year][ex.topic]) grouped[ex.year][ex.topic] = [];
		grouped[ex.year][ex.topic].push(ex);
	}

	for (const year of Object.keys(grouped)) {
		for (const topic of Object.keys(grouped[year])) {
			grouped[year][topic].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
		}
	}

	return grouped;
};

app.get('/healthz', (_req, res) => {
	res.status(200).json({ ok: true });
});

app.get('/', (req, res) => {
	const exercises = readExercises();
	const grouped = groupExercises(exercises);

	res.render('home', {
		grouped,
		counts: {
			total: exercises.length,
			y10: exercises.filter((e) => e.year === '10').length,
			y11: exercises.filter((e) => e.year === '11').length,
			y12: exercises.filter((e) => e.year === '12').length,
		},
	});
});

app.get('/materia/:year', (req, res) => {
	const year = normalizeCourse(req.params.year);
	const exercises = readExercises().filter((item) => item.year === year);
	const grouped = groupExercises(exercises);

	res.render('year', { year, grouped: grouped[year] || {} });
});

app.get('/admin/login', redirectIfAuthenticated, (req, res) => res.render('admin-login'));

app.post('/admin/login', redirectIfAuthenticated, async (req, res) => {
	const bcrypt = require('bcryptjs');
	const { username, password } = req.body;
	const configuredUser = process.env.ADMIN_USERNAME;
	const configuredHash = process.env.ADMIN_PASSWORD_HASH;

	if (!configuredUser || !configuredHash) {
		req.session.flash = {
			type: 'error',
			message: 'Configuração incompleta. Define ADMIN_USERNAME e ADMIN_PASSWORD_HASH no .env.',
		};
		return res.redirect('/admin/login');
	}

	const validUser = username === configuredUser;
	const validPassword = await bcrypt.compare(password || '', configuredHash);

	if (!validUser || !validPassword) {
		req.session.flash = { type: 'error', message: 'Credenciais inválidas.' };
		return res.redirect('/admin/login');
	}

	req.session.isAdmin = true;
	req.session.flash = { type: 'success', message: 'Sessão iniciada com sucesso.' };
	return res.redirect('/admin');
});

app.post('/admin/logout', requireAdmin, (req, res) => {
	req.session.destroy(() => res.redirect('/'));
});

app.get('/admin', requireAdmin, (req, res) => {
	const exercises = readExercises().sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
	res.render('admin-dashboard', { exercises, topics });
});

app.post('/admin/exercises', requireAdmin, upload.single('attachment'), (req, res) => {
	const { title, description, year, topic } = req.body;

	if (!title || !year || !topic || !req.file) {
		req.session.flash = {
			type: 'error',
			message: 'Título, ano, matéria e ficheiro são obrigatórios.',
		};
		return res.redirect('/admin');
	}

	const exercises = readExercises();
	const exercise = {
		id: crypto.randomUUID(),
		title: title.trim(),
		description: (description || '').trim(),
		year: normalizeCourse(year),
		topic: topic.trim(),
		fileName: req.file.filename,
		originalName: req.file.originalname,
		mimeType: req.file.mimetype,
		fileUrl: `/uploads/${req.file.filename}`,
		createdAt: new Date().toISOString(),
	};

	exercises.push(exercise);
	writeExercises(exercises);

	req.session.flash = { type: 'success', message: 'Exercício publicado com sucesso.' };
	return res.redirect('/admin');
});

app.delete('/admin/exercises/:id', requireAdmin, (req, res) => {
	const exercises = readExercises();
	const exercise = exercises.find((item) => item.id === req.params.id);

	if (!exercise) {
		req.session.flash = { type: 'error', message: 'Exercício não encontrado.' };
		return res.redirect('/admin');
	}

	writeExercises(exercises.filter((item) => item.id !== req.params.id));

	const filePath = path.join(UPLOAD_DIR, exercise.fileName);
	if (fs.existsSync(filePath)) fs.unlinkSync(filePath);

	req.session.flash = { type: 'success', message: 'Exercício removido com sucesso.' };
	return res.redirect('/admin');
});

app.use((err, req, res, _next) => {
	req.session.flash = { type: 'error', message: err.message || 'Ocorreu um erro inesperado.' };
	res.redirect(req.headers.referer || '/admin');
});

app.listen(PORT, HOST, () => {
	console.log(`Servidor disponível em http://${HOST}:${PORT}`);
});
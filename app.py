#!/usr/bin/env python3
"""
CodeGlyph Backend API
- Git commit heatmap generation
- Service cards CRUD with icon upload
- Bilingual support with OpenAI translation
"""

import os
import json
import subprocess
import uuid
from datetime import datetime, timedelta
from pathlib import Path
from flask import Flask, jsonify, request, send_from_directory
from flask_cors import CORS
from werkzeug.utils import secure_filename
from werkzeug.security import generate_password_hash, check_password_hash

# OpenAI for automatic translation
try:
    from openai import OpenAI
    OPENAI_AVAILABLE = True
except ImportError:
    OPENAI_AVAILABLE = False
    OpenAI = None

app = Flask(__name__, static_folder='static', static_url_path='')
CORS(app)

# Configuration
GIT_REPOS_BASE = os.environ.get('GIT_REPOS_BASE', '/repos')
DATA_DIR = Path('/app/data')
CARDS_FILE = DATA_DIR / 'cards.json'
SAAS_FILE = DATA_DIR / 'saas.json'
REPOS_FILE = DATA_DIR / 'repos.json'
ICONS_DIR = Path('/app/data/icons')
ADMIN_FILE = DATA_DIR / 'admin.json'
SYSTEM_STATUS_FILE = DATA_DIR / 'system-status.json'
ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'gif', 'svg', 'webp'}
MAX_FILE_SIZE = 5 * 1024 * 1024  # 5MB

# OpenAI Configuration
OPENAI_API_KEY = os.environ.get('OPENAI_API_KEY')
openai_client = None
if OPENAI_AVAILABLE and OPENAI_API_KEY:
    openai_client = OpenAI(api_key=OPENAI_API_KEY)

# Admin Configuration (from environment)
ADMIN_USERNAME = os.environ.get('ADMIN_USERNAME', 'admin')
ADMIN_PASSWORD = os.environ.get('ADMIN_PASSWORD')

SUPPORTED_LANGUAGES = ['fr', 'en']
DEFAULT_LANGUAGE = 'fr'

# Rate limiting for login
LOGIN_MAX_ATTEMPTS = 3
LOGIN_BLOCK_DURATION = 3600  # 1 hour in seconds
login_attempts = {}  # {ip: {'count': int, 'blocked_until': datetime}}

# Known git repository paths (relative to GIT_REPOS_BASE)
GIT_REPO_PATHS = [
    'Documents/FitMyCV-DEV',
    'FitMyCV',
    'AppFlowy-Cloud',
    'wisemapping/wisemapping-frontend',
    'Docker_apps/excalidraw-collaboration',
    'Piped-Docker',
]

def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS


# ============================================================================
# TRANSLATION HELPERS
# ============================================================================

def translate_text(text, source='fr', target='en'):
    """
    Translate text using OpenAI GPT-4o-mini.
    Returns the translated text, or original text if translation fails.
    """
    if not openai_client or not text or not text.strip():
        return text

    if source == target:
        return text

    lang_names = {'fr': 'French', 'en': 'English'}

    try:
        response = openai_client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {
                    "role": "system",
                    "content": f"You are a translator. Translate the following text from {lang_names.get(source, source)} to {lang_names.get(target, target)}. Return only the translated text, nothing else. Keep it concise."
                },
                {
                    "role": "user",
                    "content": text
                }
            ],
            temperature=0.3,
            max_tokens=200
        )
        return response.choices[0].message.content.strip()
    except Exception as e:
        print(f"Translation error: {e}")
        return text  # Return original text on error


def make_bilingual_description(description, source_lang='fr'):
    """
    Convert a single-language description to a bilingual object.
    Returns: {'fr': '...', 'en': '...'}
    """
    if not description:
        return {'fr': '', 'en': ''}

    # If already bilingual, return as-is
    if isinstance(description, dict):
        return description

    # Create bilingual structure
    result = {source_lang: description}

    # Translate to the other language
    target_lang = 'en' if source_lang == 'fr' else 'fr'
    result[target_lang] = translate_text(description, source_lang, target_lang)

    return result


# ============================================================================
# STATIC FILES
# ============================================================================

@app.route('/')
def serve_index():
    return send_from_directory(app.static_folder, 'index.html')

@app.route('/<path:path>')
def serve_static(path):
    return send_from_directory(app.static_folder, path)

@app.route('/data/icons/<path:path>')
def serve_data_icons(path):
    """Serve uploaded icons from data/icons/ directory."""
    return send_from_directory(DATA_DIR / 'icons', path)

# ============================================================================
# AUTHENTICATION
# ============================================================================

def load_admin():
    """Load admin credentials from JSON file, creating default if needed."""
    if ADMIN_FILE.exists():
        with open(ADMIN_FILE, 'r', encoding='utf-8') as f:
            return json.load(f)

    # Create default admin credentials from environment variables
    if not ADMIN_PASSWORD:
        raise ValueError("ADMIN_PASSWORD environment variable is required for first-time setup")

    default_admin = {
        'username': ADMIN_USERNAME,
        'passwordHash': generate_password_hash(ADMIN_PASSWORD)
    }
    save_admin(default_admin)
    return default_admin

def save_admin(data):
    """Save admin credentials to JSON file."""
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    with open(ADMIN_FILE, 'w', encoding='utf-8') as f:
        json.dump(data, f, indent=2, ensure_ascii=False)

def get_client_ip():
    """Get client IP address, considering proxies."""
    if request.headers.get('X-Forwarded-For'):
        return request.headers.get('X-Forwarded-For').split(',')[0].strip()
    return request.remote_addr

def check_rate_limit(ip):
    """Check if IP is blocked due to too many failed attempts."""
    if ip not in login_attempts:
        return None

    attempt_data = login_attempts[ip]
    if 'blocked_until' in attempt_data:
        if datetime.now() < attempt_data['blocked_until']:
            remaining = int((attempt_data['blocked_until'] - datetime.now()).total_seconds())
            return remaining
        else:
            # Block expired, reset
            del login_attempts[ip]
            return None
    return None

def record_failed_attempt(ip):
    """Record a failed login attempt and potentially block the IP."""
    if ip not in login_attempts:
        login_attempts[ip] = {'count': 0}

    login_attempts[ip]['count'] += 1

    if login_attempts[ip]['count'] >= LOGIN_MAX_ATTEMPTS:
        login_attempts[ip]['blocked_until'] = datetime.now() + timedelta(seconds=LOGIN_BLOCK_DURATION)
        return True  # Now blocked
    return False

def clear_attempts(ip):
    """Clear login attempts after successful login."""
    if ip in login_attempts:
        del login_attempts[ip]

@app.route('/api/auth/login', methods=['POST'])
def login():
    """Authenticate admin user with rate limiting."""
    ip = get_client_ip()

    # Check if IP is blocked
    blocked_for = check_rate_limit(ip)
    if blocked_for:
        minutes = blocked_for // 60
        return jsonify({
            'error': f'Trop de tentatives. Reessayez dans {minutes} minute{"s" if minutes > 1 else ""}.',
            'blockedFor': blocked_for
        }), 429

    data = request.get_json()
    username = data.get('username', '')
    password = data.get('password', '')

    admin_data = load_admin()

    if username == admin_data['username'] and check_password_hash(admin_data['passwordHash'], password):
        clear_attempts(ip)
        return jsonify({'success': True})

    # Record failed attempt
    now_blocked = record_failed_attempt(ip)
    attempts_left = LOGIN_MAX_ATTEMPTS - login_attempts.get(ip, {}).get('count', 0)

    if now_blocked:
        return jsonify({
            'error': 'Trop de tentatives. Reessayez dans 60 minutes.',
            'blockedFor': LOGIN_BLOCK_DURATION
        }), 429

    return jsonify({
        'error': 'Identifiants incorrects',
        'attemptsLeft': attempts_left
    }), 401

# ============================================================================
# GIT REPOS PERSISTENCE
# ============================================================================

def load_repos():
    """Load managed repos from JSON file, migrating from hardcoded list if needed."""
    if REPOS_FILE.exists():
        with open(REPOS_FILE, 'r', encoding='utf-8') as f:
            return json.load(f)

    # Migrate from hardcoded GIT_REPO_PATHS
    repos = []
    for repo_path in GIT_REPO_PATHS:
        full_path = Path(GIT_REPOS_BASE) / repo_path
        if (full_path / '.git').exists():
            repos.append({
                'id': repo_path.replace('/', '_'),
                'path': repo_path,
                'name': full_path.name,
                'addedAt': datetime.utcnow().isoformat() + 'Z'
            })

    data = {'repos': repos}
    save_repos(data)
    return data

def save_repos(data):
    """Save repos to JSON file."""
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    with open(REPOS_FILE, 'w', encoding='utf-8') as f:
        json.dump(data, f, indent=2, ensure_ascii=False)

# ============================================================================
# GIT HEATMAP API
# ============================================================================

@app.route('/api/git/repos', methods=['GET'])
def list_repos():
    """List all managed git repositories."""
    data = load_repos()
    default_repo = data.get('defaultRepo')
    repos = []
    for repo in data.get('repos', []):
        full_path = Path(GIT_REPOS_BASE) / repo['path']
        git_dir = full_path / '.git'
        if git_dir.exists():
            repos.append({
                'id': repo['id'],
                'name': repo['name'],
                'displayName': repo.get('displayName'),
                'description': repo.get('description'),
                'url': repo.get('url'),
                'path': repo['path'],
                'fullPath': str(full_path),
                'isDefault': repo['id'] == default_repo
            })

    # Sort: default repo first, then alphabetically by displayName or name
    repos.sort(key=lambda r: (not r['isDefault'], (r.get('displayName') or r['name']).lower()))

    return jsonify({'repos': repos, 'defaultRepo': default_repo})

@app.route('/api/git/repos/discover', methods=['GET'])
def discover_repos():
    """
    Recursively discover all git repositories in the mounted directory.
    Limited to 3 levels of depth. Returns repos not already managed.
    """
    data = load_repos()
    existing_paths = {repo['path'] for repo in data.get('repos', [])}

    discovered = []
    base_path = Path(GIT_REPOS_BASE)

    if not base_path.exists():
        return jsonify({'discovered': [], 'error': 'Base path not found'})

    # Walk through directories with depth limit of 3
    for root, dirs, files in os.walk(base_path):
        # Calculate current depth
        rel_root = Path(root).relative_to(base_path)
        depth = len(rel_root.parts) if str(rel_root) != '.' else 0

        # Skip if too deep (3 levels max)
        if depth >= 3:
            dirs[:] = []
            continue

        # Skip hidden directories except .git
        dirs[:] = [d for d in dirs if not d.startswith('.') or d == '.git']

        git_dir = Path(root) / '.git'
        if git_dir.exists() and git_dir.is_dir():
            # Get relative path from base
            rel_path = str(Path(root).relative_to(base_path))

            # Skip if already managed
            if rel_path not in existing_paths:
                discovered.append({
                    'id': rel_path.replace('/', '_'),
                    'path': rel_path,
                    'name': Path(root).name,
                    'fullPath': str(root)
                })

            # Don't descend into submodules/nested repos
            dirs[:] = []

    return jsonify({'discovered': discovered})

@app.route('/api/git/repos', methods=['POST'])
def add_repo():
    """Add a repository to the managed list."""
    data = load_repos()
    new_repo = request.get_json()

    # Validate required fields
    if not new_repo.get('path'):
        return jsonify({'error': 'Le chemin du depot est obligatoire'}), 400

    # Check if path exists and is a git repo
    full_path = Path(GIT_REPOS_BASE) / new_repo['path']
    if not (full_path / '.git').exists():
        return jsonify({'error': 'Depot Git non trouve a ce chemin'}), 404

    # Check for duplicates
    existing_ids = {repo['id'] for repo in data.get('repos', [])}
    repo_id = new_repo['path'].replace('/', '_')

    if repo_id in existing_ids:
        return jsonify({'error': 'Ce depot est deja dans la liste'}), 409

    # Add new repo
    repo_entry = {
        'id': repo_id,
        'path': new_repo['path'],
        'name': new_repo.get('name', full_path.name),
        'addedAt': datetime.utcnow().isoformat() + 'Z'
    }

    data['repos'].append(repo_entry)
    save_repos(data)

    return jsonify(repo_entry), 201

@app.route('/api/git/repos/<repo_id>', methods=['DELETE'])
def delete_repo(repo_id):
    """Remove a repository from the managed list."""
    data = load_repos()

    # Prevent deletion of the last repository
    if len(data['repos']) <= 1:
        return jsonify({'error': 'Impossible de supprimer le dernier depot'}), 400

    original_len = len(data['repos'])
    data['repos'] = [r for r in data['repos'] if r['id'] != repo_id]

    if len(data['repos']) == original_len:
        return jsonify({'error': 'Depot non trouve'}), 404

    # If deleted repo was the default, assign the first remaining one
    if data.get('defaultRepo') == repo_id:
        data['defaultRepo'] = data['repos'][0]['id'] if data['repos'] else None

    save_repos(data)
    return jsonify({'success': True, 'newDefaultRepo': data.get('defaultRepo')})

@app.route('/api/git/repos/<repo_id>/default', methods=['POST'])
def set_default_repo(repo_id):
    """Set a repository as the default."""
    data = load_repos()

    # Check if repo exists
    repo_exists = any(r['id'] == repo_id for r in data['repos'])
    if not repo_exists:
        return jsonify({'error': 'Depot non trouve'}), 404

    data['defaultRepo'] = repo_id
    save_repos(data)
    return jsonify({'success': True, 'defaultRepo': repo_id})

@app.route('/api/git/repos/<repo_id>', methods=['PATCH'])
def update_repo(repo_id):
    """Update repository metadata (displayName, description, url)."""
    data = load_repos()

    repo = next((r for r in data['repos'] if r['id'] == repo_id), None)
    if not repo:
        return jsonify({'error': 'Depot non trouve'}), 404

    updates = request.get_json()

    # Update allowed fields
    if 'displayName' in updates:
        display_name = updates['displayName'].strip() if updates['displayName'] else None
        if display_name:
            repo['displayName'] = display_name
        elif 'displayName' in repo:
            del repo['displayName']  # Revert to default name

    if 'description' in updates:
        description = updates['description'].strip() if updates['description'] else None
        if description:
            # Get source language from request (default to 'fr')
            source_lang = updates.get('source_lang', 'fr')
            if source_lang not in SUPPORTED_LANGUAGES:
                source_lang = 'fr'

            # Check if description changed (compare against current source language)
            current_desc = repo.get('description', {})
            current_source = current_desc.get(source_lang, '') if isinstance(current_desc, dict) else current_desc

            if description != current_source:
                # Description changed, create bilingual version
                repo['description'] = make_bilingual_description(description, source_lang)
            # else keep existing bilingual description
        elif 'description' in repo:
            del repo['description']

    if 'url' in updates:
        url = updates['url'].strip() if updates['url'] else None
        if url:
            repo['url'] = url
        elif 'url' in repo:
            del repo['url']

    save_repos(data)
    return jsonify(repo)

@app.route('/api/git/heatmap/<repo_id>', methods=['GET'])
def get_heatmap(repo_id):
    """
    Get commit heatmap data for a repository.
    Returns commits grouped by date and hour (0-23).

    Query params:
    - since: Start date in YYYY-MM-DD format (optional, defaults to first commit)
    """
    # Find the repo path from id
    repo_path = repo_id.replace('_', '/')
    full_path = Path(GIT_REPOS_BASE) / repo_path

    if not (full_path / '.git').exists():
        return jsonify({'error': 'Repository not found'}), 404

    since_date = request.args.get('since', None)

    try:
        # Build git log command
        git_cmd = [
            'git', '-C', str(full_path),
            'log', '--all',
            '--format=%ad',
            '--date=format:%Y-%m-%d %H'
        ]

        if since_date:
            git_cmd.append(f'--since={since_date}')

        result = subprocess.run(
            git_cmd,
            capture_output=True,
            text=True,
            timeout=30
        )

        if result.returncode != 0:
            return jsonify({'error': 'Git command failed'}), 500

        # Parse commits
        commits = {}
        lines = result.stdout.strip().split('\n')

        for line in lines:
            if not line:
                continue
            parts = line.split(' ')
            if len(parts) >= 2:
                date = parts[0]
                hour = parts[1]
                key = f"{date}-{hour}"
                commits[key] = commits.get(key, 0) + 1

        # Get first commit date if no since parameter
        if not since_date:
            first_cmd = [
                'git', '-C', str(full_path),
                'log', '--all', '--reverse',
                '--format=%ad',
                '--date=format:%Y-%m-%d',
            ]
            first_result = subprocess.run(first_cmd, capture_output=True, text=True, timeout=10)
            first_lines = first_result.stdout.strip().split('\n')
            since_date = first_lines[0] if first_lines and first_lines[0] else datetime.now().strftime('%Y-%m-%d')

        # Calculate statistics
        total_commits = sum(commits.values())
        unique_dates = set(k.rsplit('-', 1)[0] for k in commits.keys()) if commits else set()
        unique_days = len(unique_dates)

        # Find peak hour
        hour_counts = {}
        for key, count in commits.items():
            hour = key.split('-')[-1]
            hour_counts[hour] = hour_counts.get(hour, 0) + count
        peak_hour = max(hour_counts, key=hour_counts.get) if hour_counts else '12'

        # Calculate current streak (consecutive days up to today)
        current_streak = 0
        if unique_dates:
            today = datetime.now().date()
            check_date = today
            sorted_dates = sorted(unique_dates, reverse=True)
            date_set = set(sorted_dates)

            # Check if today or yesterday has commits (streak can include today)
            while check_date.isoformat() in date_set:
                current_streak += 1
                check_date = check_date - timedelta(days=1)

            # If no commits today, check from yesterday
            if current_streak == 0:
                check_date = today - timedelta(days=1)
                while check_date.isoformat() in date_set:
                    current_streak += 1
                    check_date = check_date - timedelta(days=1)

        # Find busiest day of week
        day_names_fr = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche']
        weekday_counts = {i: 0 for i in range(7)}
        for key, count in commits.items():
            date_str = key.rsplit('-', 1)[0]
            try:
                date_obj = datetime.strptime(date_str, '%Y-%m-%d')
                weekday_counts[date_obj.weekday()] += count
            except ValueError:
                pass
        busiest_weekday = max(weekday_counts, key=weekday_counts.get) if any(weekday_counts.values()) else 0
        busiest_day = day_names_fr[busiest_weekday]

        # Average commits per active day
        avg_commits = round(total_commits / unique_days, 1) if unique_days > 0 else 0

        return jsonify({
            'repo': repo_path,
            'repoName': full_path.name,
            'sinceDate': since_date,
            'commits': commits,
            'stats': {
                'totalCommits': total_commits,
                'uniqueDays': unique_days,
                'peakHour': int(peak_hour),
                'currentStreak': current_streak,
                'busiestDay': busiest_day,
                'avgCommitsPerDay': avg_commits
            }
        })

    except subprocess.TimeoutExpired:
        return jsonify({'error': 'Request timeout'}), 504
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# ============================================================================
# SERVICE CARDS CRUD API
# ============================================================================

def load_cards():
    """Load cards from JSON file."""
    if CARDS_FILE.exists():
        with open(CARDS_FILE, 'r', encoding='utf-8') as f:
            return json.load(f)
    return {'cards': []}

def save_cards(data):
    """Save cards to JSON file."""
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    with open(CARDS_FILE, 'w', encoding='utf-8') as f:
        json.dump(data, f, indent=2, ensure_ascii=False)

@app.route('/api/cards', methods=['GET'])
def get_cards():
    """List all service cards."""
    data = load_cards()
    # Sort by order and ensure public field exists (migration)
    cards = sorted(data.get('cards', []), key=lambda x: x.get('order', 999))
    for card in cards:
        card.setdefault('public', True)
    return jsonify({'cards': cards})

@app.route('/api/cards', methods=['POST'])
def create_card():
    """Create a new service card with auto-translation."""
    data = load_cards()
    new_card = request.get_json()

    # Validate required fields
    required = ['title', 'link']
    for field in required:
        if not new_card.get(field):
            return jsonify({'error': f'Le champ "{field}" est obligatoire'}), 400

    # Get source language from request (default to 'fr')
    source_lang = new_card.pop('source_lang', 'fr')
    if source_lang not in SUPPORTED_LANGUAGES:
        source_lang = 'fr'

    # Generate ID and set defaults
    new_card['id'] = str(uuid.uuid4())[:8]
    new_card.setdefault('icon', 'icons/default.svg')
    new_card.setdefault('order', len(data['cards']) + 1)
    new_card.setdefault('public', True)

    # Handle bilingual description - auto-translate if string provided
    description = new_card.get('description', '')
    new_card['description'] = make_bilingual_description(description, source_lang)

    data['cards'].append(new_card)
    save_cards(data)

    return jsonify(new_card), 201

@app.route('/api/cards/<card_id>', methods=['GET'])
def get_card(card_id):
    """Get a single card by ID."""
    data = load_cards()
    card = next((c for c in data['cards'] if c['id'] == card_id), None)
    if not card:
        return jsonify({'error': 'Carte non trouvee'}), 404
    return jsonify(card)

@app.route('/api/cards/<card_id>', methods=['PUT'])
def update_card(card_id):
    """Update an existing card with auto-translation."""
    data = load_cards()
    card_index = next((i for i, c in enumerate(data['cards']) if c['id'] == card_id), None)

    if card_index is None:
        return jsonify({'error': 'Carte non trouvee'}), 404

    updates = request.get_json()
    current_card = data['cards'][card_index]

    # Get source language from request (default to 'fr')
    source_lang = updates.pop('source_lang', 'fr')
    if source_lang not in SUPPORTED_LANGUAGES:
        source_lang = 'fr'

    # Handle description update with auto-translation
    new_description = updates.get('description')
    if new_description is not None:
        if isinstance(new_description, str):
            # Check if description actually changed (compare against current source language)
            current_desc = current_card.get('description', {})
            current_source = current_desc.get(source_lang, '') if isinstance(current_desc, dict) else current_desc

            if new_description != current_source:
                # Description changed, translate it
                updates['description'] = make_bilingual_description(new_description, source_lang)
            else:
                # Keep existing translations
                updates['description'] = current_desc

    # Preserve ID
    updates['id'] = card_id
    data['cards'][card_index].update(updates)
    save_cards(data)

    return jsonify(data['cards'][card_index])

def delete_uploaded_icon(icon_path):
    """Delete an uploaded icon file if it exists and is not a default icon."""
    if not icon_path or not icon_path.startswith('data/icons/'):
        return
    # Don't delete default icons
    if 'default' in icon_path:
        return
    # Build full path and delete if exists
    full_path = Path('/app') / icon_path
    if full_path.exists() and full_path.is_file():
        try:
            full_path.unlink()
        except OSError:
            pass  # Ignore deletion errors


@app.route('/api/cards/<card_id>', methods=['DELETE'])
def delete_card(card_id):
    """Delete a card and its uploaded icon."""
    data = load_cards()

    # Find the card to get its icon path before deletion
    card_to_delete = next((c for c in data['cards'] if c['id'] == card_id), None)
    if not card_to_delete:
        return jsonify({'error': 'Carte non trouvee'}), 404

    # Delete the uploaded icon
    delete_uploaded_icon(card_to_delete.get('icon'))

    # Remove the card
    data['cards'] = [c for c in data['cards'] if c['id'] != card_id]
    save_cards(data)
    return jsonify({'success': True})

@app.route('/api/cards/reorder', methods=['POST'])
def reorder_cards():
    """Reorder cards. Expects array of {id, order} objects."""
    data = load_cards()
    order_data = request.get_json()

    if not isinstance(order_data, list):
        return jsonify({'error': 'Format attendu: tableau de {id, order}'}), 400

    order_map = {item['id']: item['order'] for item in order_data}

    for card in data['cards']:
        if card['id'] in order_map:
            card['order'] = order_map[card['id']]

    save_cards(data)
    return jsonify({'success': True})

# ============================================================================
# SAAS CRUD API
# ============================================================================

def load_saas():
    """Load SaaS from JSON file."""
    if SAAS_FILE.exists():
        with open(SAAS_FILE, 'r', encoding='utf-8') as f:
            return json.load(f)
    return {'saas': []}

def save_saas(data):
    """Save SaaS to JSON file."""
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    with open(SAAS_FILE, 'w', encoding='utf-8') as f:
        json.dump(data, f, indent=2, ensure_ascii=False)

@app.route('/api/saas', methods=['GET'])
def get_saas():
    """List all SaaS."""
    data = load_saas()
    return jsonify({'saas': data.get('saas', [])})

@app.route('/api/saas', methods=['POST'])
def create_saas():
    """Create a new SaaS entry with auto-translation."""
    data = load_saas()
    new_saas = request.get_json()

    # Validate required fields (only icon is required)
    if not new_saas.get('icon'):
        return jsonify({'error': 'Le champ "icon" est obligatoire'}), 400

    # Get source language from request (default to 'fr')
    source_lang = new_saas.pop('source_lang', 'fr')
    if source_lang not in SUPPORTED_LANGUAGES:
        source_lang = 'fr'

    # Generate ID and set defaults
    new_saas['id'] = str(uuid.uuid4())[:8]
    new_saas.setdefault('title', '')
    new_saas.setdefault('link', '')

    # Handle bilingual description
    description = new_saas.get('description', '')
    new_saas['description'] = make_bilingual_description(description, source_lang)

    data['saas'].append(new_saas)
    save_saas(data)

    return jsonify(new_saas), 201

@app.route('/api/saas/<saas_id>', methods=['GET'])
def get_saas_by_id(saas_id):
    """Get a single SaaS by ID."""
    data = load_saas()
    saas = next((s for s in data['saas'] if s['id'] == saas_id), None)
    if not saas:
        return jsonify({'error': 'SaaS non trouve'}), 404
    return jsonify(saas)

@app.route('/api/saas/<saas_id>', methods=['PUT'])
def update_saas(saas_id):
    """Update an existing SaaS with auto-translation."""
    data = load_saas()
    saas_index = next((i for i, s in enumerate(data['saas']) if s['id'] == saas_id), None)

    if saas_index is None:
        return jsonify({'error': 'SaaS non trouve'}), 404

    updates = request.get_json()
    current_saas = data['saas'][saas_index]

    # Get source language from request (default to 'fr')
    source_lang = updates.pop('source_lang', 'fr')
    if source_lang not in SUPPORTED_LANGUAGES:
        source_lang = 'fr'

    # Handle description update with auto-translation
    new_description = updates.get('description')
    if new_description is not None:
        if isinstance(new_description, str):
            current_desc = current_saas.get('description', {})
            current_source = current_desc.get(source_lang, '') if isinstance(current_desc, dict) else current_desc

            if new_description != current_source:
                updates['description'] = make_bilingual_description(new_description, source_lang)
            else:
                updates['description'] = current_desc

    # Preserve ID
    updates['id'] = saas_id
    data['saas'][saas_index].update(updates)
    save_saas(data)

    return jsonify(data['saas'][saas_index])

@app.route('/api/saas/<saas_id>', methods=['DELETE'])
def delete_saas(saas_id):
    """Delete a SaaS and its uploaded icon."""
    data = load_saas()

    # Find the SaaS to get its icon path before deletion
    saas_to_delete = next((s for s in data['saas'] if s['id'] == saas_id), None)
    if not saas_to_delete:
        return jsonify({'error': 'SaaS non trouve'}), 404

    # Delete the uploaded icon
    delete_uploaded_icon(saas_to_delete.get('icon'))

    # Remove the SaaS
    data['saas'] = [s for s in data['saas'] if s['id'] != saas_id]
    save_saas(data)
    return jsonify({'success': True})

# ============================================================================
# ICON UPLOAD API
# ============================================================================

@app.route('/api/cards/upload-icon', methods=['POST'])
def upload_icon():
    """Upload an icon file. Optional 'folder' form field for subfolder (e.g., 'saas')."""
    if 'file' not in request.files:
        return jsonify({'error': 'Aucun fichier fourni'}), 400

    file = request.files['file']
    folder = request.form.get('folder', '')  # Optional subfolder

    if file.filename == '':
        return jsonify({'error': 'Aucun fichier selectionne'}), 400

    if not allowed_file(file.filename):
        return jsonify({'error': 'Type de fichier non autorise. Utilisez: png, jpg, jpeg, gif, svg, webp'}), 400

    # Check file size
    file.seek(0, 2)  # Seek to end
    file_size = file.tell()
    file.seek(0)  # Seek back to start

    if file_size > MAX_FILE_SIZE:
        return jsonify({'error': 'Fichier trop volumineux (max 5MB)'}), 400

    # Generate unique filename
    ext = file.filename.rsplit('.', 1)[1].lower()
    filename = f"{uuid.uuid4().hex[:12]}.{ext}"
    filename = secure_filename(filename)

    # Determine target directory
    if folder and folder in ['saas', 'app']:  # Whitelist allowed subfolders
        target_dir = ICONS_DIR / folder
        icon_path = f'data/icons/{folder}/{filename}'
    else:
        # Default to 'app' folder for cards
        target_dir = ICONS_DIR / 'app'
        icon_path = f'data/icons/app/{filename}'

    # Save file
    target_dir.mkdir(parents=True, exist_ok=True)
    file_path = target_dir / filename
    file.save(str(file_path))

    return jsonify({
        'success': True,
        'path': icon_path,
        'filename': filename
    })

# ============================================================================
# SYSTEM MONITORING API
# ============================================================================

@app.route('/api/system/status', methods=['GET'])
def get_system_status():
    """
    Get system status (CPU, RAM, disks, services).
    Data is written by a host-side cron script to avoid container limitations.
    """
    try:
        if not SYSTEM_STATUS_FILE.exists():
            return jsonify({
                'error': 'Donnees systeme non disponibles',
                'cpu': 0,
                'ram': 0,
                'disks': [],
                'services': [],
                'timestamp': datetime.utcnow().isoformat() + 'Z'
            }), 503

        with open(SYSTEM_STATUS_FILE, 'r', encoding='utf-8') as f:
            data = json.load(f)

        return jsonify(data)

    except json.JSONDecodeError:
        return jsonify({'error': 'Format de donnees invalide'}), 500
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# ============================================================================
# HEALTH CHECK
# ============================================================================

@app.route('/api/health', methods=['GET'])
def health_check():
    return jsonify({'status': 'ok', 'timestamp': datetime.utcnow().isoformat()})

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=4000, debug=True)

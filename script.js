  const authForm = document.getElementById('authForm');
  const authTitle = document.getElementById('authTitle');
  const authPrimary = document.getElementById('authPrimary');
  const toggleAuth = document.getElementById('toggleAuth');
  const emailRow = document.getElementById('emailRow');
  const msg = document.getElementById('authMsg');


// Hide email on login
 let isLogin = true;
  emailRow.style.display = 'none';

  function showMessage(text, color='green') {
    msg.textContent = text;
    setTimeout(()=>msg.textContent='',3000);
  }
toggleAuth.addEventListener('click', ()=>{
  isLogin = !isLogin;
  if(isLogin){
    authTitle.textContent = 'Login';
    authPrimary.textContent = 'Login';
    emailRow.style.display = 'none';
    toggleAuth.textContent = 'Create account';
  } else {
    authTitle.textContent = 'Register';
    authPrimary.textContent = 'Register';
    emailRow.style.display = 'block';
    toggleAuth.textContent = 'Already have an account? Login';
  }
});

authForm.addEventListener('submit', (e)=>{
  e.preventDefault();
  const username = document.getElementById('username').value.trim();
  const password = document.getElementById('password').value.trim();
  const email = document.getElementById('email').value.trim();
  if(!username || !password){
    showMessage('Please fill all fields','red');
    return;
  }

  let users = JSON.parse(localStorage.getItem('users')) || [];

  if(isLogin){
    const user = users.find(u=>u.username===username && u.password===password);
    if(user){
      localStorage.setItem('loggedInUser', JSON.stringify(user));
      showMessage(`Welcome back, ${user.username}!`);
      setTimeout(()=>{window.location.reload();},1000);
    } else {
      showMessage('Invalid username or password','red');
    }
  } else {
    if(users.some(u=>u.username===username)){
      showMessage('Username already exists','red');
      return;
    }
    const newUser = {username,email,password,progress:{level:1,score:0}};
    users.push(newUser);
    localStorage.setItem('users', JSON.stringify(users));
    showMessage('Registration successful! You can now log in.');
    toggleAuth.click();
  }
});

// Auto login session
window.addEventListener('load', ()=>{
  const logged = JSON.parse(localStorage.getItem('loggedInUser'));
  if(logged){
    authForm.style.display='none';
    authTitle.textContent = `Welcome, ${logged.username}`;
    toggleAuth.style.display='none';
    msg.textContent = `Logged in as ${logged.username}`;
  }
});

function showLevelScreen(user){
  const levelScreen = document.getElementById('levelScreen');
  const levelsContainer = document.getElementById('levelsContainer');
  levelScreen.style.display = 'block';
  levelsContainer.innerHTML = ''; // clear existing

  const maxLevel = 10; // total levels
  const unlocked = user.progress.level; // current unlocked level

  for(let i=1; i<=maxLevel; i++){
    const btn = document.createElement('div');
    btn.className = 'level-btn' + (i > unlocked ? ' locked' : '');
    btn.textContent = 'Level ' + i;

    if(i <= unlocked){
      btn.addEventListener('click', ()=>{
        alert('Starting Level ' + i);
        // Here later we’ll call your game start function with level=i
      });
    }

    levelsContainer.appendChild(btn);
  }
}

// After auto-login
window.addEventListener('load', ()=>{
  const logged = JSON.parse(localStorage.getItem('loggedInUser'));
  if(logged){
    authForm.style.display='none';
    authTitle.textContent = `Welcome, ${logged.username}`;
    toggleAuth.style.display='none';
    msg.textContent = `Logged in as ${logged.username}`;

    // Show level selection
    showLevelScreen(logged);
  }
});

// Also call showLevelScreen after successful login/registration:
function afterLogin(user){
  authForm.style.display='none';
  authTitle.textContent = `Welcome, ${user.username}`;
  toggleAuth.style.display='none';
  msg.textContent = `Logged in as ${user.username}`;
  showLevelScreen(user);
}

// Replace calls to window.location.reload() after login with afterLogin(user)

document.addEventListener('DOMContentLoaded', () => {
    const openAddDialog = document.getElementById('open_add_dialog');
    const addDialog = document.getElementById('add_dialog');
    const closeAddDialog = document.getElementById('close_add_dialog');

    if (!addDialog || !closeAddDialog || !openAddDialog) {
        console.error('Dialog modal, close button или open button не найдены!');
        return;
    }

    openAddDialog.addEventListener('click', () => {
        addDialog.style.display = 'block';
    });

    closeAddDialog.addEventListener('click', () => {
        addDialog.style.display = 'none';
    });

    window.addEventListener('click', (event) => {
        if (event.target === addDialog) {
            addDialog.style.display = 'none';
        }
    });
});

function validateAddForm() {
    const title = document.querySelector('input[name="title"]').value.trim();
    const description = document.querySelector('textarea[name="description"]').value.trim();
    const startTime = document.querySelector('input[name="start-time"]').value;
    const endTime = document.querySelector('input[name="end-time"]').value;
    const type = document.querySelector('select[name="type"]').value.trim();
    const executors = document.querySelectorAll('input[name="executors[]"]:checked');
    const dialogContent = document.querySelector('#add_dialog .dialog-content');
    let errorMessage = document.querySelector('#add_dialog .error-message');

    if (errorMessage) {
        errorMessage.remove();
    }

    if (!title || !description || !startTime || !endTime || !type) {
        errorMessage = document.createElement('p');
        errorMessage.className = 'error-message text-font text-black';
        errorMessage.textContent = 'Все поля, кроме исполнителей, должны быть заполнены';
        dialogContent.insertBefore(errorMessage, dialogContent.children[2]); 
        return false;
    }

    if (executors.length === 0) {
        errorMessage = document.createElement('p');
        errorMessage.className = 'error-message text-font text-black';
        errorMessage.textContent = 'Необходимо выбрать хотя бы одного исполнителя';
        dialogContent.insertBefore(errorMessage, dialogContent.children[2]); 
        return false;
    }

    return true;
}
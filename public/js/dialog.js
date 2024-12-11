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


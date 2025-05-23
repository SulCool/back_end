document.addEventListener('DOMContentLoaded', () => {
    const profileIcon = document.querySelector('.profile-icon');
    const modal = document.querySelector('.modal');
    const closeBtn = document.querySelector('.close');

    if (!profileIcon || !modal || !closeBtn) {
        console.error('Profile icon, modal или close button не найдены!');
        return;
    }

    profileIcon.addEventListener('click', (event) => {
        event.stopPropagation();
        modal.style.display = 'block';
    });

    closeBtn.addEventListener('click', () => {
        modal.style.display = 'none';
    });

    window.addEventListener('click', (event) => {
        if (!modal.contains(event.target) && event.target !== profileIcon) {
            modal.style.display = 'none';
        }
    });

    const editDialog = document.getElementById('edit_dialog');
    const closeEditDialog = document.getElementById('close_edit_dialog');

    if (!editDialog || !closeEditDialog) {
        console.error('Edit dialog modal или close button не найдены!');
        return;
    }

    document.querySelectorAll('[id^="open_edit_dialog_"]').forEach(button => {
        button.addEventListener('click', () => {
            const taskId = button.id.replace('open_edit_dialog_', '');
            const taskData = document.querySelector(`.task-data[data-task-id="${taskId}"]`);
            if (!taskData) {
                console.error('Данные задачи не найдены!');
                return;
            }
            const title = taskData.dataset.title;
            const description = taskData.dataset.description;
            const startTime = taskData.dataset.startTime;
            const endTime = taskData.dataset.endTime;
            const executors = JSON.parse(taskData.dataset.executors);
            const type = taskData.dataset.type;

            document.getElementById('edit_taskId').value = taskId;
            document.getElementById('edit_title').value = title;
            document.getElementById('edit_description').value = description;
            document.getElementById('edit_start-time').value = startTime.slice(0, 16);
            document.getElementById('edit_end-time').value = endTime.slice(0, 16);

            const executorCheckboxes = document.querySelectorAll('.executor-checkboxes input[name="executors[]"]');
            executorCheckboxes.forEach(checkbox => {
                checkbox.checked = executors.includes(checkbox.value);
            });
            document.getElementById('edit_type').value = type;

            editDialog.style.display = 'block';
        });
    });

    closeEditDialog.addEventListener('click', () => {
        editDialog.style.display = 'none';
    });

    window.addEventListener('click', (event) => {
        if (event.target === editDialog) {
            editDialog.style.display = 'none';
        }
    });

    function validateEditForm() {
        const title = document.querySelector('#edit_title').value.trim();
        const description = document.querySelector('#edit_description').value.trim();
        const startTime = document.querySelector('#edit_start-time').value;
        const endTime = document.querySelector('#edit_end-time').value;
        const type = document.querySelector('#edit_type').value.trim();
        const executors = document.querySelectorAll('#edit_dialog .executor-checkboxes input[name="executors[]"]:checked');
        const dialogContent = document.querySelector('#edit_dialog .dialog-content');
        let errorMessage = document.querySelector('#edit_dialog .error-message');
    
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
    
        const now = new Date();
        const endDate = new Date(endTime);
        if (endDate < now) {
            errorMessage = document.createElement('p');
            errorMessage.className = 'error-message text-font text-black';
            errorMessage.textContent = 'Дата окончания не может быть в прошлом';
            dialogContent.insertBefore(errorMessage, dialogContent.children[2]);
            return false;
        }
    
        return true;
    }

    const editForm = document.querySelector('#edit_dialog form');
    if (editForm) {
        editForm.addEventListener('submit', (event) => {
            if (!validateEditForm()) {
                event.preventDefault();
            }
        });
    }
});
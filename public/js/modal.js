document.addEventListener('DOMContentLoaded', () => {
    const profileIcon = document.querySelector('.profile-icon');
    const modal = document.querySelector('.modal');
    const closeBtn = document.querySelector('.close');

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
});

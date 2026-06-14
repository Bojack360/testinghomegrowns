document.getElementById("loginform1").addEventListener("submit", function(event){
    event.preventDefault();

    const username = document.getElementById("username").value;
    const password = document.getElementById("password").value;

    if(username === "admin" && password === "admin123"){
        alert("Logged In Successfully");
        window.location.href = "merchadmin.html";
    } 
    else if(username === "user" && password === "user123"){
        alert("Logged In Successfully");
        window.location.href = "index.html";
    } 
    else {
        alert("Invalid username or password!");
    }
});
$( document ).ready(function() {

  // Get the container element
  var descMe = document.getElementById("descMe");

  var descMe = document.getElementById("contact");

  navbarItems[i].addEventListener("click", function() {
      descMe.hide();
  }

  // Get all buttons with class="btn" inside the container
  var navbarItems = btnContainer.getElementsByClassName("navbar-link");

  // Loop through the buttons and add the active class to the current/clicked button
  for (var i = 0; i < navbar.length; i++) {
    navbarItems[i].addEventListener("click", function() {

      var current = document.getElementsByClassName("active");

      // If there's no active class
      if (current.length > 0) {
        current[0].className = current[0].className.replace(" active", "");
      }

      // Add the active class to the current/clicked button
      this.className += " active";
    });
  }

  document.getElementById('active').focus();

});

$(document).ready(function(){
  //page

  $('#descMe').on("click",".navbar-link",function(e){
  e.preventDefault(); // cancel click
  var page = $(this).attr('href');
  $('#descMe').load(page);
  });

});

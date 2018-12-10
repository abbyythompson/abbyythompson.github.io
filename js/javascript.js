$(document).ready(function() {

  $('#descriptionBody').fadeIn(1000);
  $('#contactBody').css('display', 'none');
  $('#workBody').css('display', 'none');

  //Click Me
  $('#description').click(function() {
    event.preventDefault();
    $('#contactBody').hide();
    $('#workBody').hide();
    $('#descriptionBody').fadeIn(1000);

    $(this).addClass('active');
    $('#work').removeClass('active');
    $('#contact').removeClass('active');
  });

  //Click Work
  $('#work').click(function() {
    event.preventDefault();
    $('#contactBody').hide();
    $('#descriptionBody').hide();
    $('#workBody').fadeIn(1000);

    $('#description').removeClass('active');
    $(this).addClass('active');
    $('#contact').removeClass('active');
  });

  //Click Contact
  $('#contact').click(function() {
    event.preventDefault();
    $('#descriptionBody').hide();
    $('#workBody').hide();
    $('#contactBody').fadeIn(1000);

    $('#description').removeClass('active');
    $('#work').removeClass('active');
    $(this).addClass('active');
  });


});
